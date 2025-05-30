import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";

export default function Entry() {
    const url = process.env.NODE_ENV === 'production' ? "/royaka-2025-fe/" : "/";
    const [animationComplete, setAnimationComplete] = useState(false);
    const [showTitle, setShowTitle] = useState(false);
    const [showButton, setShowButton] = useState(false);
    const navigate = useNavigate();
    const handlePlay = () => {
         if (localStorage.getItem("session_id")) {
            navigate("/lobby")
        } else {
            navigate("/auth")
        }
    };

    useEffect(() => {
        // Sequence the animations with more time for slower connections
        const timer1 = setTimeout(() => setAnimationComplete(true), 600);
        const timer2 = setTimeout(() => setShowTitle(true), 1400);
        const timer3 = setTimeout(() => setShowButton(true), 2000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 overflow-hidden relative" style={{ fontFamily: "'ClashDisplay', sans-serif" }}>
            {/* Animated background elements - with better positioning */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Background particles */}
                <div className="absolute w-full h-full">
                    {[...Array(30)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 bg-blue-300 rounded-full animate-pulse"
                            style={{
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                opacity: 0.4,
                                animationDuration: `${Math.random() * 3 + 2}s`,
                                animationDelay: `${Math.random() * 2}s`
                            }}
                        ></div>
                    ))}
                </div>
            </div>

            {/* Main content container - ENLARGED and centered */}
            <div className="z-10 relative w-full min-h-screen flex flex-col items-center justify-center">
                {/* Crown animation that comes from top - ENLARGED */}
                <div className="relative flex justify-center mb-10">
                    <div
                        className={`transition-all duration-1000 ease-out transform
                        ${animationComplete ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'}`}
                    >
                        <img
                            className="w-60 pointer-events-none"
                            src={`${url}assets/icon_crown.png`}
                            alt=""
                        />
                    </div>

                    {/* Flash effect when crown lands - ENLARGED */}
                    <div
                        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 delay-800
                        ${animationComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                    >
                        <div className="animate-ping opacity-70 duration-300">
                            <svg
                                className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72"
                                viewBox="0 0 200 200"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle cx="100" cy="100" r="50" fill="white" fillOpacity="0.3" />
                                <circle cx="100" cy="100" r="30" fill="white" fillOpacity="0.5" />
                                {/* Light rays */}
                                <path d="M100 10L110 90L100 100L90 90L100 10Z" fill="white" fillOpacity="0.3" />
                                <path d="M100 190L110 110L100 100L90 110L100 190Z" fill="white" fillOpacity="0.3" />
                                <path d="M10 100L90 110L100 100L90 90L10 100Z" fill="white" fillOpacity="0.3" />
                                <path d="M190 100L110 110L100 100L110 90L190 100Z" fill="white" fillOpacity="0.3" />
                                <path d="M30 30L92 92L100 100L92 92L30 30Z" fill="white" fillOpacity="0.3" />
                                <path d="M170 170L108 108L100 100L108 108L170 170Z" fill="white" fillOpacity="0.3" />
                                <path d="M30 170L92 108L100 100L92 108L30 170Z" fill="white" fillOpacity="0.3" />
                                <path d="M170 30L108 92L100 100L108 92L170 30Z" fill="white" fillOpacity="0.3" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ROYAKA logo text with animated reveal - ENLARGED text */}
                <div className={`relative transition-all duration-700 ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    <div className="text-center mt-10">
                        {/* Main title with blue-to-yellow gradient similar to Clash Royale */}
                        <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-blue-200 via-blue-100 to-yellow-200 mb-4 tracking-wide select-none drop-shadow-lg">
                            ROYAKA
                        </h1>

                        {/* Battle Arena subtitle with animated reveal */}
                        <div className="relative overflow-hidden">
                            <p className="text-white text-2xl sm:text-3xl md:text-4xl font-semibold mb-4">Battle Arena</p>

                            {/* Gold accent bar - WIDER */}
                            <div className="h-2 w-40 sm:w-48 md:w-56 bg-gradient-to-r from-yellow-400 to-yellow-600 mx-auto rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Blue light beam effects from top and bottom - ENLARGED */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className={`absolute left-1/2 top-0 w-40 sm:w-48 h-96 sm:h-screen bg-blue-500 opacity-20 rounded-full blur-xl transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-1000 ${showTitle ? 'opacity-20' : 'opacity-0'}`}></div>
                    <div className={`absolute left-1/2 bottom-0 w-40 sm:w-48 h-96 sm:h-screen bg-blue-500 opacity-20 rounded-full blur-xl transform -translate-x-1/2 translate-y-1/2 transition-opacity duration-1000 ${showTitle ? 'opacity-20' : 'opacity-0'}`}></div>
                </div>

                {/* Play Game button with Clash Royale style - ENLARGED */}
                <div className={`z-10 mt-12 text-center transition-all duration-700 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    <button
                        onClick={handlePlay}
                        className="relative overflow-hidden group bg-gradient-to-b from-yellow-400 to-yellow-600 text-white font-bold px-12 sm:px-16 md:px-20 py-5 sm:py-6 rounded-xl shadow-lg border-b-4 border-yellow-700 transform transition-all duration-200 hover:scale-105 active:translate-y-1 active:border-b-2"
                    >
                        <span className="relative z-10 text-xl sm:text-2xl md:text-3xl uppercase tracking-wider">Play Now</span>

                        {/* Button shine effect */}
                        <span className="absolute top-0 -left-full h-full w-1/2 bg-white opacity-20 transform skew-x-12 group-hover:translate-x-[250%] transition-all duration-700"></span>
                    </button>
                </div>
            </div>

            {/* Mobile portrait mode notification - kept for small screens */}
            <div className="absolute bottom-6 left-0 w-full text-center text-xs text-blue-200 opacity-60 px-4 md:hidden">
                <p>Best experienced on a laptop - landscape size</p>
            </div>
        </div>
    );
}