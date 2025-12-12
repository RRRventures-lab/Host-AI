import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Square, Volume2, Activity, AlertCircle, ArrowLeft, User, MessageSquare, BookOpen, Clock, Sparkles, FlaskConical, BrainCircuit, Disc, CheckCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Lead, CallStatus, TranscriptEntry, KnowledgeSnippet } from '../types';

interface LiveAgentProps {
    activeLead?: Lead;
    knowledgeBase?: KnowledgeSnippet[];
    onUpdateLead?: (lead: Lead) => void;
    onLearn?: (snippet: KnowledgeSnippet) => void;
    onBack?: () => void;
}

// --- Audio Helpers ---
function encodePCM(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- RAG Logic ---
const selectRelevantSnippets = (lead: Lead, kb: KnowledgeSnippet[]): KnowledgeSnippet[] => {
    if (!kb || kb.length === 0) return [];

    // 1. Build a Context Profile from the Lead
    const contextText = `${lead.notes || ''} ${lead.cuisine} ${lead.location}`.toLowerCase();
    const historyText = lead.transcript ? lead.transcript.map(t => t.text).join(' ').toLowerCase() : '';
    const fullContext = contextText + ' ' + historyText;

    // 2. Define High-Value Keywords to look for
    const keywords = [
        'busy', 'manager', 'expensive', 'cost', 'price', 'hostess', 'email', 'send info', 'not interested', 'later'
    ];

    // 3. Score each snippet
    const scoredSnippets = kb.map(snippet => {
        let score = 0;
        const contentLower = snippet.content.toLowerCase();
        
        // Rule A: Exact Restaurant Match (Highest Priority - Learned from previous call with SAME lead)
        if (snippet.sourceRestaurant === lead.restaurantName) {
            score += 50; 
        }

        // Rule B: Cuisine Match (Relevance to niche)
        if (lead.cuisine && contentLower.includes(lead.cuisine.toLowerCase())) {
            score += 15;
        }

        // Rule C: Context Keyword Overlap (Objection handling relevance)
        keywords.forEach(word => {
            if (fullContext.includes(word) && contentLower.includes(word)) {
                score += 10; // High relevance if the problem (context) matches the solution (snippet)
            }
        });

        // Rule D: Category Weighting based on Lead Status/Score
        if (lead.status === CallStatus.FAILED && snippet.category === 'objection_handling') {
            score += 5; // Prioritize objection handling for retries
        }
        if (lead.priceRange === '$$$$' && snippet.category === 'value_proposition') {
            score += 5; // Prioritize value props for high-end
        }

        // Rule E: Recency (Slight boost for newer strategies)
        // Assuming simple string sort for now, could parse dates
        score += 1; 

        return { snippet, score };
    });

    // 4. Sort and Slice
    return scoredSnippets
        .sort((a, b) => b.score - a.score)
        .filter(item => item.score > 0) // Only return relevant items
        .slice(0, 3) // Take top 3
        .map(item => item.snippet);
};


const LiveAgentDemo: React.FC<LiveAgentProps> = ({ activeLead, knowledgeBase = [], onUpdateLead, onLearn, onBack }) => {
  // Local state for Test Mode
  const [testLead, setTestLead] = useState<Lead | null>(null);
  const effectiveLead = activeLead || testLead;
  
  // Track latest lead ref to prevent stale closures during async AI updates
  const latestLeadRef = useRef<Lead | null>(null);
  useEffect(() => {
    latestLeadRef.current = effectiveLead || null;
  }, [effectiveLead]);

  // State for retrieved RAG data to display in UI
  const [activeRagSnippets, setActiveRagSnippets] = useState<KnowledgeSnippet[]>([]);

  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  
  // Transcript State
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>(effectiveLead?.transcript || []);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Summary & Training State
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [learningStatus, setLearningStatus] = useState<string | null>(null);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Scroll to bottom of transcript
  useEffect(() => {
    if (transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcripts, currentInput, currentOutput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (isActive) stopSession();
    };
  }, [isActive]);

  // Update transcripts if effectiveLead changes (e.g. switching leads)
  useEffect(() => {
    if (effectiveLead) {
        setTranscripts(effectiveLead.transcript || []);
        setSummary(null);
        setLearningStatus(null);
        setActiveRagSnippets([]);
    }
  }, [effectiveLead?.id]);

  const startTestMode = () => {
    const dummyLead: Lead = {
        id: 'test-preview',
        restaurantName: "Test Kitchen Preview",
        contactName: "Restaurant Manager",
        phone: "+1 (555) 000-0000",
        status: CallStatus.PENDING,
        cuisine: "Modern Fusion",
        location: "SoHo, NY",
        priceRange: '$$$',
        score: 85,
        notes: "Client mentioned they are usually too busy to answer phones during dinner service."
    };
    setTestLead(dummyLead);
  };

  const generateSystemInstruction = () => {
    if (!effectiveLead) return "You are a helpful assistant.";

    // RAG RETRIEVAL STEP (Smart Selection)
    const relevantKnowledge = selectRelevantSnippets(effectiveLead, knowledgeBase);
    setActiveRagSnippets(relevantKnowledge); // Update UI to show what's being used

    const knowledgeContext = relevantKnowledge.length > 0 
      ? `\n\n[KNOWLEDGE BASE - USE THESE STRATEGIES]:
         The following strategies have worked for similar restaurants or contexts:
         ${relevantKnowledge.map(k => `- When discussing ${k.category.replace('_', ' ')}: "${k.content}"`).join('\n')}
         \nPrioritize using these specific phrases if the conversation topic arises.`
      : "";
    
    return `You are 'Alex', an expert AI sales agent for 'Host AI', a high-end restaurant automation agency.
    
    CURRENT CALL CONTEXT:
    - Restaurant: ${effectiveLead.restaurantName} (${effectiveLead.cuisine}, ${effectiveLead.priceRange})
    - Contact Person: ${effectiveLead.contactName}
    - Notes from CRM: ${effectiveLead.notes || "None"}
    ${knowledgeContext}
    
    YOUR GOAL: Book a 15-minute demo meeting with ${effectiveLead.contactName}.

    CRITICAL BEHAVIORAL INSTRUCTIONS:
    1. MULTILINGUAL ADAPTATION: If the user speaks a language other than English (e.g., Spanish, French, Mandarin, Italian), IMMEDIATELY switch to that language and continue the pitch fluently. Do not ask for permission to switch, just do it.
    2. ULTRA-LOW LATENCY: Keep your responses short, punchy, and direct (1-2 sentences max). This ensures a fast, natural conversation flow. Do not ramble.
    
    STRATEGY:
    1. Greeting: "Hi, is this ${effectiveLead.contactName}? This is Alex from Host AI."
    2. Hook: "I'm calling because I know ${effectiveLead.restaurantName} gets incredibly busy, and our AI ensures you never miss a VIP reservation call."
    3. Objection Handling: If they mention a hostess, explain we handle overflow so the hostess can focus on the guests *in* the restaurant.
    4. Closing: Ask for a 15 min demo.
    
    Tone: Professional, premium, confident.`;
  };

  const processPostCall = async () => {
    // Combine committed transcripts and any partials
    const fullTranscript = [...transcripts];
    if (currentInput.trim()) fullTranscript.push({ role: 'user', text: currentInput, timestamp: 'now' });
    if (currentOutput.trim()) fullTranscript.push({ role: 'model', text: currentOutput, timestamp: 'now' });

    if (fullTranscript.length === 0) return;

    setIsSummarizing(true);
    setSummary(null);
    setLearningStatus(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const transcriptText = fullTranscript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

    // Parallelize or isolate errors for Summary vs Training
    try {
      // 1. Generate Summary - Fast Response with Flash Lite
      const summaryResponse = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest', 
        contents: `Analyze the following sales call transcript between an AI agent (Host AI) and a potential client.
        Return a JSON object with:
        - summary: A concise text summary.
        - sentiment: "Positive", "Neutral", or "Negative".
        - outcome: "BOOKED", "COMPLETED", or "FAILED". Use "BOOKED" ONLY if the user explicitly agreed to a meeting/demo.
        
        Transcript:
        ${transcriptText}`,
        config: { responseMimeType: "application/json" }
      });
      
      const analysis = JSON.parse(summaryResponse.text);
      setSummary(analysis.summary);

      // Status Update based on AI Analysis
      // Use ref to get the absolute latest state (including recording if it was just added)
      const currentLeadState = latestLeadRef.current;
      if (analysis.outcome === 'BOOKED' && onUpdateLead && currentLeadState) {
          onUpdateLead({ 
              ...currentLeadState, 
              status: CallStatus.BOOKED,
              sentiment: analysis.sentiment,
              score: 100 // Max score for booking
          });
      }
    } catch (e: any) {
        console.error("Summary failed", e);
        setSummary("Analysis temporarily unavailable.");
    }

    // 2. RAG TRAINING STEP - Complex Thinking
    if (fullTranscript.length > 4 && onLearn) {
        setLearningStatus("Analyzing call for new training data...");
        try {
            const trainingResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', // Use Pro for complex analysis
                contents: `Analyze this transcript. Did the agent successfully handle an objection, use a great hook, or use a strong closing line?
                If yes, extract ONE specific technique in JSON format.
                If nothing noteworthy happened, return valid JSON with "found": false.
                
                Schema:
                {
                    "found": boolean,
                    "category": "objection_handling" | "value_proposition" | "closing_technique",
                    "content": "The specific phrase or argument the agent used that worked well"
                }

                Transcript:
                ${transcriptText}`,
                config: { 
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 32768 } // Enable Thinking for deep analysis
                }
            });

            const trainingData = JSON.parse(trainingResponse.text);
            if (trainingData.found && trainingData.content) {
                const newSnippet: KnowledgeSnippet = {
                    id: Date.now().toString(),
                    category: trainingData.category,
                    content: trainingData.content,
                    sourceRestaurant: effectiveLead.restaurantName,
                    timestamp: new Date().toLocaleDateString()
                };
                onLearn(newSnippet);
                setLearningStatus("Success! New strategy added to Knowledge Base.");
            } else {
                setLearningStatus("No new strategies detected.");
            }
        } catch (e: any) {
             console.error("Training failed", e);
             setLearningStatus("Training skipped due to API timeout.");
        }
    }

    setIsSummarizing(false);
  };

  const startSession = async () => {
    if (!effectiveLead) return;
    try {
      setStatus('connecting');
      setErrorMsg(null);
      setTranscripts([]); 
      setSummary(null); 
      setLearningStatus(null);
      setActiveRagSnippets([]);
      recordingChunksRef.current = []; // Reset recording

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup Audio Routing
      const outputCtx = outputAudioContextRef.current!;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);
      
      // Setup Recording Destination (Mixer)
      const recordingDest = outputCtx.createMediaStreamDestination();
      recordingDestinationRef.current = recordingDest;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect Mic to Recording Mixer (Cross-context check handled by letting getUserMedia stream be source for both)
      // Note: We need a source in the outputCtx to mix it for recording
      const micRecordingSource = outputCtx.createMediaStreamSource(stream);
      micRecordingSource.connect(recordingDest);

      // Start Media Recorder
      const mediaRecorder = new MediaRecorder(recordingDest.stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: generateSystemInstruction(),
          inputAudioTranscription: {}, 
          outputAudioTranscription: {} 
        },
        callbacks: {
          onopen: () => {
            console.log("Connected");
            setStatus('listening');
            setIsActive(true);
            if (onUpdateLead && activeLead) {
                onUpdateLead({...activeLead, status: CallStatus.IN_PROGRESS});
            }

            // Input Pipeline for Gemini (separate context for 16k sample rate preference)
            if (!inputAudioContextRef.current || !streamRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Visualizer volume
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.min(Math.sqrt(sum / inputData.length) * 10, 1));

              const base64PCM = encodePCM(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { mimeType: 'audio/pcm;rate=16000', data: base64PCM }
                });
              }).catch(err => {
                  console.error("Session send failed:", err);
              });
            };
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Transcriptions
            const serverContent = message.serverContent;
            if (serverContent?.inputTranscription) {
                setCurrentInput(prev => prev + serverContent.inputTranscription.text);
            }
            if (serverContent?.outputTranscription) {
                setCurrentOutput(prev => prev + serverContent.outputTranscription.text);
            }
            if (serverContent?.turnComplete) {
                // Commit transcripts to history
                if (currentInput.trim()) {
                     setTranscripts(prev => [...prev, {role: 'user', text: currentInput, timestamp: new Date().toLocaleTimeString()}]);
                     setCurrentInput('');
                }
                if (currentOutput.trim()) {
                     setTranscripts(prev => [...prev, {role: 'model', text: currentOutput, timestamp: new Date().toLocaleTimeString()}]);
                     setCurrentOutput('');
                }
            }

            // 2. Handle Audio
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setStatus('speaking');
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              
              // Connect to Speakers
              source.connect(outputNode);
              // Connect to Recorder Mixer
              if (recordingDestinationRef.current) {
                  source.connect(recordingDestinationRef.current);
              }

              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus('listening');
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // 3. Handle Interruptions
            if (serverContent?.interrupted) {
               sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setStatus('listening');
               // Commit partial output if interrupted
               if (currentOutput) {
                   setTranscripts(prev => [...prev, {role: 'model', text: currentOutput + "...", timestamp: new Date().toLocaleTimeString()}]);
                   setCurrentOutput('');
               }
            }
          },
          onclose: () => {
            setIsActive(false);
            setStatus('idle');
            // Save recording logic is handled in stopSession() which calls handleEndCall()
          },
          onerror: (err) => {
            console.error(err);
            setErrorMsg("Connection error: " + err.message);
            setStatus('error');
            stopSession();
          }
        }
      });
    } catch (e: any) {
      console.error(e);
      let msg = e.message;
      if (msg.includes('Deadline')) {
        msg = "Server timed out. Please try again.";
      }
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const stopSession = () => {
    // Stop Media Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.onstop = () => {
             const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             reader.onloadend = () => {
                 const base64data = reader.result as string;
                 
                 // Heuristic Outcome Logic - fallback if AI fails or takes too long
                 let newStatus = CallStatus.COMPLETED;
                 let newSentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';

                 if (transcripts.length > 6) {
                    newSentiment = 'Positive';
                 } else if (transcripts.length < 2) {
                    newStatus = CallStatus.FAILED;
                    newSentiment = 'Negative';
                 }

                 if (onUpdateLead && activeLead) {
                    onUpdateLead({
                        ...activeLead, 
                        status: newStatus,
                        sentiment: newSentiment,
                        transcript: transcripts,
                        lastContacted: 'Just now',
                        recording: base64data // Save the recording
                    });
                 }
             };
        };
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    // SAFE CLOSE: Check state before closing
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsActive(false);
    setStatus('idle');
    setVolume(0);
  };

  const handleEndCall = () => {
    stopSession();
    processPostCall(); // Trigger RAG extraction and AI Status check
  };

  // --- Render: No Lead Selected (Show Test Mode) ---
  if (!effectiveLead) {
    return (
        <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-500">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl shadow-indigo-500/10">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FlaskConical size={32} className="text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">Ready to Test?</h2>
                <p className="text-slate-400 mb-8">
                    Preview the agent's voice capabilities without selecting a real lead from your database.
                </p>
                <div className="space-y-3">
                    <button 
                        onClick={startTestMode}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <Play size={18} fill="currentColor" /> Test Agent Now
                    </button>
                    <button 
                        onClick={onBack} 
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors"
                    >
                        Return to Leads
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // --- Render: Main Agent View ---
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Left: CRM & Transcript Context */}
      <div className="w-full md:w-1/3 flex flex-col gap-4 h-full">
        {/* Lead Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex-shrink-0">
            <button onClick={() => { setTestLead(null); if (onBack) onBack(); }} className="mb-4 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                <ArrowLeft size={12} /> Back to List
            </button>
            
            <div className="flex justify-between items-start">
                 <h2 className="text-xl font-bold text-slate-100">{effectiveLead.restaurantName}</h2>
                 <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-400">SCORE</span>
                    <span className={`text-lg font-bold ${
                        effectiveLead.score >= 80 ? 'text-green-400' : effectiveLead.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{effectiveLead.score}</span>
                 </div>
            </div>

            <div className="flex items-center gap-2 text-indigo-400 text-sm mb-4">
                <span className="bg-indigo-500/10 px-2 py-0.5 rounded">{effectiveLead.cuisine}</span>
                <span className="text-slate-500">•</span>
                <span>{effectiveLead.priceRange}</span>
            </div>
            
            <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                    <User size={16} className="text-slate-500" />
                    {effectiveLead.contactName}
                </div>
                {/* RAG Context Indicator */}
                {knowledgeBase.length > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-purple-400">
                         <BrainCircuit size={14} />
                         <span className="font-semibold">Contextual RAG Retrieval</span>
                    </div>
                    {activeRagSnippets.length > 0 ? (
                        <div className="space-y-1">
                            {activeRagSnippets.map((s, idx) => (
                                <div key={idx} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                                    <span className="text-purple-500 mt-0.5">•</span>
                                    <span className="line-clamp-2">{s.content}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-500 italic ml-4">No high-relevance strategies found for this context.</span>
                    )}
                  </div>
                )}
            </div>
        </div>

        {/* Live Transcript Log */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-0">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <MessageSquare size={14} /> Live Transcript
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {isActive ? 'Recording...' : 'Offline'}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={transcriptRef}>
                {transcripts.length === 0 && (
                    <div className="text-center text-slate-600 py-10 text-sm italic">
                        Start the call to see real-time transcription.
                    </div>
                )}
                {transcripts.map((t, i) => (
                    <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                            t.role === 'user' 
                                ? 'bg-indigo-600/20 text-indigo-100 rounded-tr-sm' 
                                : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                        }`}>
                            <p>{t.text}</p>
                            <span className="text-[10px] opacity-50 mt-1 block">{t.timestamp}</span>
                        </div>
                    </div>
                ))}
                {currentInput && (
                    <div className="flex justify-end opacity-70">
                         <div className="max-w-[85%] p-3 rounded-xl text-sm bg-indigo-600/10 text-indigo-100 rounded-tr-sm border border-indigo-500/20 border-dashed">
                            {currentInput}
                         </div>
                    </div>
                )}
                {currentOutput && (
                    <div className="flex justify-start opacity-70">
                         <div className="max-w-[85%] p-3 rounded-xl text-sm bg-slate-800/50 text-slate-200 rounded-tl-sm border border-slate-700 border-dashed">
                            {currentOutput}
                         </div>
                    </div>
                )}
            </div>
        </div>

        {/* Call Summary Panel */}
        {(summary || isSummarizing || learningStatus) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 shadow-lg border-t-indigo-500/50">
                <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-yellow-400" /> Post-Call Analysis
                </h3>
                {isSummarizing ? (
                    <div className="flex items-center gap-3 text-xs text-slate-400 py-2">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        Generating insights from conversation...
                    </div>
                ) : (
                     <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                        {summary}
                     </div>
                )}
                {learningStatus && (
                    <div className="mt-3 pt-3 border-t border-slate-800 text-xs flex items-center gap-2">
                         <BrainCircuit size={12} className={learningStatus.includes('Success') ? 'text-green-400' : 'text-purple-400'} />
                         <span className={learningStatus.includes('Success') ? 'text-green-400' : 'text-slate-400'}>
                             {learningStatus}
                         </span>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Right: Agent Visualizer */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
        {/* Background Ambient Effect */}
        <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
        
        {/* Visualizer */}
        <div className="relative z-10 flex flex-col items-center gap-8 mb-8">
          <div className="relative">
             {isActive && (
                <>
                <div className={`absolute inset-0 rounded-full border border-indigo-500/30 scale-110 ${status === 'speaking' ? 'animate-[ping_2s_linear_infinite]' : ''}`}></div>
                <div className={`absolute inset-0 rounded-full border border-indigo-500/20 scale-125 ${status === 'speaking' ? 'animate-[ping_3s_linear_infinite_0.5s]' : ''}`}></div>
                </>
            )}
            <div className={`w-48 h-48 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border-4 flex items-center justify-center transition-all duration-300 ${
                isActive ? 'border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.4)]' : 'border-slate-700'
            }`}>
                 {isActive ? (
                     <div className="flex gap-1.5 items-center h-20">
                         {[1,2,3,4,5,6].map(i => (
                             <div key={i} className="w-3 bg-indigo-400 rounded-full transition-all duration-75"
                                style={{ height: status === 'speaking' ? `${Math.random() * 60 + 20}px` : status === 'listening' ? `${volume * 80 + 10}px` : '8px' }}
                             ></div>
                         ))}
                     </div>
                 ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-600">
                        <Activity size={48} />
                        <span className="text-xs font-medium uppercase tracking-widest">Host AI</span>
                    </div>
                 )}
            </div>
          </div>
        </div>

        {/* Status Indicator (Centralized) */}
        <div className="mb-6 flex flex-col items-center gap-2 z-10">
            <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 text-sm font-semibold tracking-wide shadow-lg transition-all ${
                status === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' :
                status === 'idle' ? 'bg-slate-800/50 border-slate-700 text-slate-400' :
                status === 'connecting' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' :
                status === 'speaking' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' :
                'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
            }`}>
                <div className={`w-2 h-2 rounded-full ${
                    status === 'error' ? 'bg-red-500' :
                    status === 'idle' ? 'bg-slate-500' :
                    status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                    status === 'speaking' ? 'bg-indigo-500 animate-pulse' :
                    'bg-emerald-500'
                }`}></div>
                {status === 'idle' ? 'Ready to Connect' : 
                 status === 'connecting' ? 'Establishing Connection...' :
                 status.toUpperCase()}
            </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 z-10">
            {effectiveLead.status === CallStatus.BOOKED ? (
                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in">
                    <div className="px-8 py-4 bg-green-500/10 border border-green-500/50 text-green-400 font-bold rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                        <CheckCircle size={24} /> <span>Meeting Booked!</span>
                    </div>
                    {onBack && (
                        <button onClick={onBack} className="text-slate-400 hover:text-indigo-400 text-sm font-medium underline underline-offset-4 transition-colors">
                            Return to Dashboard
                        </button>
                    )}
                </div>
            ) : !isActive ? (
              <button onClick={startSession} className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full transition-all shadow-lg hover:scale-105 flex items-center gap-3">
                <Mic size={24} /> <span>Initiate Call to {effectiveLead.restaurantName}</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                  <button onClick={handleEndCall} className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/50 font-bold rounded-full transition-all flex items-center gap-3">
                    <Square size={24} fill="currentColor" /> <span>End Call</span>
                  </button>
                  <div className="flex items-center gap-2 text-xs text-red-400 animate-pulse">
                      <Disc size={12} /> Recording In Progress
                  </div>
              </div>
            )}
        </div>

        {errorMsg && (
          <div className="absolute bottom-6 bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAgentDemo;