import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from "../assets/ai.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif";

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [conversation, setConversation] = useState([]);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const [ham, setHam] = useState(false);
  const isRecognizingRef = useRef(false);
  const synth = window.speechSynthesis;
  const chatContainerRef = useRef(null);

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current?.start();
        console.log("Recognition requested to start");
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Start error:", error);
        }
      }
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang === 'hi-IN');
    if (hindiVoice) utterance.voice = hindiVoice;

    isSpeakingRef.current = true;
    utterance.onend = () => {
      setAiText("");
      isSpeakingRef.current = false;
      setTimeout(() => startRecognition(), 800);
    };

    synth.cancel();
    synth.speak(utterance);
  };

  const handleCommand = (data) => {
    const { type, userInput, response } = data;
    speak(response);
    setConversation(prev => [...prev, { type: 'user', text: userInput }, { type: 'ai', text: response }]);

    const openNewTab = (url) => window.open(url, '_blank');
    const search = (query) => openNewTab(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    const youtubeSearch = (query) => openNewTab(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);

    switch (type) {
      case 'google-search': search(userInput); break;
      case 'calculator-open': search("calculator"); break;
      case 'instagram-open': openNewTab("https://www.instagram.com/"); break;
      case 'facebook-open': openNewTab("https://www.facebook.com/"); break;
      case 'weather-show': search("weather"); break;
      case 'youtube-search':
      case 'youtube-play': youtubeSearch(userInput); break;
      default: break;
    }
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognitionRef.current = recognition;
    let isMounted = true;

    const startTimeout = setTimeout(() => {
      if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current) {
        try {
          recognition.start();
          console.log("Recognition requested to start");
        } catch (e) {
          if (e.name !== "InvalidStateError") console.error(e);
        }
      }
    }, 1000);

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start();
              console.log("Recognition restarted");
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e);
            }
          }
        }, 1000);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      isRecognizingRef.current = false;
      setListening(false);
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start();
              console.log("Recognition restarted after error");
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e);
            }
          }
        }, 1000);
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      if (transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        setAiText("");
        setUserText(transcript);
        recognition.stop();
        isRecognizingRef.current = false;
        setListening(false);
        const data = await getGeminiResponse(transcript);
        handleCommand(data);
        setAiText(data.response);
        setUserText("");
      }
    };

    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`);
    greeting.lang = 'hi-IN';
    window.speechSynthesis.speak(greeting);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
      recognition.stop();
      setListening(false);
      isRecognizingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <div className='w-full min-h-screen bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-4 overflow-hidden p-4'>
      {/* Mobile Menu Button */}
      <CgMenuRight className='lg:hidden text-white fixed top-4 right-4 w-7 h-7 z-50' onClick={() => setHam(true)} />

      {/* Mobile Menu Panel */}
      <div className={`fixed lg:hidden top-0 w-full h-full bg-[#00000080] backdrop-blur-lg p-5 flex flex-col gap-6 items-start z-40 ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}>
        <RxCross1 className='text-white absolute top-4 right-4 w-6 h-6' onClick={() => setHam(false)} />
        <button className='w-full h-12 text-black font-semibold bg-white rounded-full text-lg' onClick={handleLogOut}>Log Out</button>
        <button className='w-full h-12 text-black font-semibold bg-white rounded-full text-lg' onClick={() => navigate("/customize")}>Customize your Assistant</button>
      </div>

      {/* Desktop Buttons */}
      <div className='hidden lg:flex gap-4 fixed top-4 right-4 z-30'>
        <button className='min-w-[120px] h-10 bg-white text-black font-semibold rounded-full text-sm px-4' onClick={handleLogOut}>Log Out</button>
        <button className='min-w-[120px] h-10 bg-white text-black font-semibold rounded-full text-sm px-4' onClick={() => navigate("/customize")}>Customize</button>
      </div>

      {/* Assistant Avatar */}
      <div className='w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] md:w-[300px] md:h-[300px] flex justify-center items-center overflow-hidden rounded-3xl shadow-lg mb-4'>
        <img src={userData?.assistantImage} alt="" className='h-full object-cover' />
      </div>
      <h1 className='text-white text-lg font-semibold mb-2 text-center'>I'm {userData?.assistantName}</h1>

      {/* Conversation Section */}
      <div ref={chatContainerRef} className='w-full max-w-2xl h-[45vh] sm:h-[50vh] md:h-[60vh] bg-white bg-opacity-10 rounded-2xl p-4 overflow-y-auto mb-4'>
        {conversation.map((msg, index) => (
          <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
              msg.type === 'user' ? 'bg-blue-500 text-white' : 'bg-white bg-opacity-20 text-white'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Current Message Display */}
      <div className='flex items-center gap-3 flex-wrap justify-center text-center'>
        {!aiText && <img src={userImg} alt="" className='w-16' />}
        {aiText && <img src={aiImg} alt="" className='w-16' />}
        <h1 className='text-white text-base font-medium break-words max-w-[90vw]'>{userText || aiText || null}</h1>
      </div>
    </div>
  );
}

export default Home;
