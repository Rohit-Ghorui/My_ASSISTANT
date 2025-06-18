import React, { useContext, useEffect, useRef, useState } from 'react'
import { userDataContext } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import aiImg from "../assets/ai.gif"
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import userImg from "../assets/user.gif"

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext)
  const navigate = useNavigate()
  const [listening, setListening] = useState(false)
  const [userText, setUserText] = useState("")
  const [aiText, setAiText] = useState("")
  const [conversation, setConversation] = useState([])
  const isSpeakingRef = useRef(false)
  const recognitionRef = useRef(null)
  const [ham, setHam] = useState(false)
  const isRecognizingRef = useRef(false)
  const synth = window.speechSynthesis
  const chatContainerRef = useRef(null)

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true })
      setUserData(null)
      navigate("/signin")
    } catch (error) {
      setUserData(null)
      console.log(error)
    }
  }

  const startRecognition = () => {
    if (!isSpeakingRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current?.start();
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          console.error("Start error:", error);
        }
      }
    }
  }

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'hi-IN'
    const voices = window.speechSynthesis.getVoices()
    const hindiVoice = voices.find(v => v.lang === 'hi-IN')
    if (hindiVoice) {
      utterance.voice = hindiVoice
    }

    isSpeakingRef.current = true
    utterance.onend = () => {
      setAiText("")
      isSpeakingRef.current = false
      setTimeout(() => {
        startRecognition()
      }, 800)
    }
    synth.cancel()
    synth.speak(utterance)
  }

  const handleCommand = (data) => {
    const { type, userInput, response } = data
    speak(response)
    setConversation(prev => [...prev, { type: 'user', text: userInput }, { type: 'ai', text: response }])

    const open = (url) => window.open(url, "_blank")
    const query = encodeURIComponent(userInput)

    if (type === 'google-search') open(`https://www.google.com/search?q=${query}`)
    if (type === 'calculator-open') open(`https://www.google.com/search?q=calculator`)
    if (type === 'instagram-open') open(`https://www.instagram.com/`)
    if (type === 'facebook-open') open(`https://www.facebook.com/`)
    if (type === 'weather-show') open(`https://www.google.com/search?q=weather`)
    if (type === 'youtube-search' || type === 'youtube-play') open(`https://www.youtube.com/results?search_query=${query}`)
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognitionRef.current = recognition

    let isMounted = true
    const startTimeout = setTimeout(() => {
      if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current) {
        try {
          recognition.start()
        } catch (e) {
          if (e.name !== "InvalidStateError") console.error(e)
        }
      }
    }, 1000)

    recognition.onstart = () => {
      isRecognizingRef.current = true
      setListening(true)
    }

    recognition.onend = () => {
      isRecognizingRef.current = false
      setListening(false)
      if (isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start()
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e)
            }
          }
        }, 1000)
      }
    }

    recognition.onerror = (event) => {
      isRecognizingRef.current = false
      setListening(false)
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isMounted) {
            try {
              recognition.start()
            } catch (e) {
              if (e.name !== "InvalidStateError") console.error(e)
            }
          }
        }, 1000)
      }
    }

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim()
      if (transcript.toLowerCase().includes(userData.assistantName.toLowerCase())) {
        setAiText("")
        setUserText(transcript)
        recognition.stop()
        isRecognizingRef.current = false
        setListening(false)
        const data = await getGeminiResponse(transcript)
        handleCommand(data)
        setAiText(data.response)
        setUserText("")
      }
    }

    const greeting = new SpeechSynthesisUtterance(`Hello ${userData.name}, what can I help you with?`)
    greeting.lang = 'hi-IN'
    window.speechSynthesis.speak(greeting)

    return () => {
      isMounted = false
      clearTimeout(startTimeout)
      recognition.stop()
      setListening(false)
      isRecognizingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [conversation])

  return (
    <div className='w-full h-[100vh] bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-[15px] overflow-hidden'>

      {/* Mobile Menu */}
      <CgMenuRight className='lg:hidden text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(true)} />
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham ? "translate-x-0" : "translate-x-full"} transition-transform`}>
        <RxCross1 className='text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={() => setHam(false)} />
        <button className='w-full text-center h-[50px] text-black font-semibold bg-white rounded-full text-[16px]' onClick={handleLogOut}>Log Out</button>
        <button className='w-full text-center h-[50px] text-black font-semibold bg-white rounded-full text-[16px]' onClick={() => navigate("/customize")}>Customize Assistant</button>
      </div>

      {/* Desktop Buttons */}
      <button className='hidden lg:block absolute top-[20px] right-[20px] min-w-[150px] h-[50px] text-black font-semibold bg-white rounded-full text-[16px]' onClick={handleLogOut}>Log Out</button>
      <button className='hidden lg:block absolute top-[80px] right-[20px] min-w-[150px] h-[50px] text-black font-semibold bg-white rounded-full text-[16px]' onClick={() => navigate("/customize")}>Customize Assistant</button>

      {/* Main Content */}
      <div className='flex flex-col items-center w-full max-w-4xl px-4'>
        {/* Assistant Avatar */}
        <div className='w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] flex justify-center items-center overflow-hidden rounded-4xl shadow-lg mb-4'>
          <img src={userData?.assistantImage} alt="" className='h-full object-cover' />
        </div>
        <h1 className='text-white text-[18px] font-semibold mb-4'>I'm {userData?.assistantName}</h1>

        {/* Chat Box */}
        <div
          ref={chatContainerRef}
          className='w-full h-[400px] bg-[#ffffff1a] rounded-2xl p-4 overflow-y-auto mb-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent'
        >
          {conversation.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.type === 'ai' && (
                <img
                  src={userData?.assistantImage}
                  alt="AI"
                  className="w-8 h-8 rounded-full object-cover mt-1"
                />
              )}
              <div
                className={`px-4 py-2 text-sm sm:text-[15px] rounded-2xl max-w-[75%] sm:max-w-[65%] break-words ${
                  msg.type === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-black rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
              {msg.type === 'user' && (
                <img
                  src={userImg}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover mt-1"
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Message */}
        <div className='flex items-center gap-4 flex-wrap text-center justify-center'>
          {!aiText && <img src={userImg} alt="" className='w-[80px]' />}
          {aiText && <img src={aiImg} alt="" className='w-[80px]' />}
          <h1 className='text-white text-[16px] font-medium max-w-full break-words'>{userText || aiText || null}</h1>
        </div>
      </div>
    </div>
  )
}

export default Home
