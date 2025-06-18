import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from '../assets/ai.gif';
import userImg from '../assets/user.gif';

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();
  const [userText, setUserText] = useState('');
  const [aiText, setAiText] = useState('');
  const [conversation, setConversation] = useState([]);
  const [assistantStarted, setAssistantStarted] = useState(false);
  const [micError, setMicError] = useState(false);

  const recognitionRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const synth = window.speechSynthesis;

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate('/signin');
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    const voices = synth.getVoices();
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) utterance.voice = hindiVoice;

    isSpeakingRef.current = true;
    utterance.onend = () => {
      setAiText('');
      isSpeakingRef.current = false;
      setTimeout(() => startRecognition(), 800);
    };

    synth.cancel();
    synth.speak(utterance);
  };

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        if (e.name !== 'InvalidStateError') console.error(e);
      }
    }
  };

  const retryMicAccess = () => {
    setMicError(false);
    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        setTimeout(() => {
          recognitionRef.current.start();
        }, 300);
      }
    } catch (e) {
      console.error("Mic retry failed:", e);
      setMicError(true);
    }
  };

  const handleCommand = (data) => {
    const { type, userInput, response } = data;
    speak(response);
    setConversation(prev => [...prev, { type: 'user', text: userInput }, { type: 'ai', text: response }]);

    const open = (url) => window.open(url, '_blank');
    const query = encodeURIComponent(userInput);

    switch (type) {
      case 'google-search': open(`https://www.google.com/search?q=${query}`); break;
      case 'calculator-open': open('https://www.google.com/search?q=calculator'); break;
      case 'instagram-open': open('https://www.instagram.com/'); break;
      case 'facebook-open': open('https://www.facebook.com/'); break;
      case 'weather-show': open('https://www.google.com/search?q=weather'); break;
      case 'youtube-search':
      case 'youtube-play': open(`https://www.youtube.com/results?search_query=${query}`); break;
    }
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => isRecognizingRef.current = true;

    recognition.onend = () => {
      isRecognizingRef.current = false;
      if (!isSpeakingRef.current && !micError) {
        setTimeout(() => startRecognition(), 1000);
      }
    };

    recognition.onerror = (event) => {
      isRecognizingRef.current = false;
      console.error("Recognition error:", event.error);

      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        setMicError(true);
        return;
      }

      if (!isSpeakingRef.current && !micError) {
        setTimeout(() => startRecognition(), 1000);
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      if (transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        setUserText(transcript);
        recognition.stop();
        const data = await getGeminiResponse(transcript);
        handleCommand(data);
        setAiText(data.response);
        setUserText('');
      }
    };

    return () => recognition.stop();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleStartAssistant = () => {
    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`);
    greeting.lang = 'hi-IN';
    greeting.onend = () => startRecognition();
    synth.cancel();
    synth.speak(greeting);
    setAssistantStarted(true);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-black to-[#02023d] flex flex-col items-center py-6 px-4 sm:px-8">
      <div className="w-full max-w-6xl flex justify-between items-center mb-4">
        <div />
        <div className="flex flex-wrap gap-3 justify-center">
          <button className="px-4 py-2 bg-white text-black rounded-full text-sm font-medium" onClick={handleLogOut}>
            Log Out
          </button>
          <button className="px-4 py-2 bg-white text-black rounded-full text-sm font-medium" onClick={() => navigate('/customize')}>
            Customize Assistant
          </button>
        </div>
      </div>

      {!assistantStarted ? (
        <button className="bg-yellow-400 text-black font-semibold text-lg px-6 py-3 rounded-full mt-10" onClick={handleStartAssistant}>
          Start Assistant
        </button>
      ) : (
        <div className="w-full max-w-3xl flex flex-col items-center">
          <img src={userData?.assistantImage} className="w-40 h-40 sm:w-52 sm:h-52 rounded-full object-cover mb-4" alt="assistant" />
          <h1 className="text-white text-lg sm:text-xl mb-4">I'm {userData?.assistantName}</h1>

          <div
            ref={chatContainerRef}
            className="w-full h-[400px] bg-white bg-opacity-10 rounded-xl p-4 overflow-y-auto mb-6 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-gray-500"
          >
            {conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}>
                {msg.type === 'ai' && <img src={userData.assistantImage} className="w-8 h-8 rounded-full object-cover" />}
                <div className={`px-4 py-2 rounded-2xl text-sm sm:text-base max-w-[70%] break-words
                  ${msg.type === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-black rounded-bl-none'}`}>
                  {msg.text}
                </div>
                {msg.type === 'user' && <img src={userImg} className="w-8 h-8 rounded-full object-cover" />}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 text-white text-base sm:text-lg text-center">
            <img src={aiText ? aiImg : userImg} className="w-16" alt="" />
            <p className="max-w-full break-words">{userText || aiText || null}</p>

            {micError && (
              <button
                onClick={retryMicAccess}
                className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-semibold"
              >
                Retry Microphone Access
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
