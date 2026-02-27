import React, { useEffect, useMemo, useState } from 'react';

interface UnicornAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getSpeedDuration = (speed: string): number => {
  switch (speed) {
    case 'slow':
      return 4000;
    case 'fast':
      return 2000;
    default:
      return 2800;
  }
};

const getScale = (size: string): number => {
  switch (size) {
    case 'small':
      return 0.5;
    case 'large':
      return 1;
    default:
      return 0.75;
  }
};

export function UnicornAnimation({ speed = 'normal', size = 'medium', onComplete }: UnicornAnimationProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const duration = getSpeedDuration(speed);
  const scale = getScale(size);

  const bodyGradientId = React.useId();
  const hornGradientId = React.useId();
  const maneGradientId = React.useId();
  const tailGradientId = React.useId();
  const shadowGradientId = React.useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const stars = useMemo(() => Array.from({ length: 10 }), []);
  const planets = useMemo(() => Array.from({ length: 10 }), []);

  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        @keyframes unicornRunAcross {
          from { transform: translateX(calc(100vw + 120px)) translateY(50vh) scale(${scale}); }
          to { transform: translateX(-980px) translateY(50vh) scale(${scale}); }
        }

        .celebration-unicorn-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          overflow: hidden;
        }

        .celebration-unicorn-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 840px;
          height: 620px;
          transform-origin: top left;
          animation: unicornRunAcross ${duration}ms linear forwards;
        }

        .celebration-unicorn {
          box-sizing: border-box;
          margin: 0;
          overflow: hidden;
          width: 840px;
          height: 620px;
          position: relative;
        }

        .celebration-unicorn *,
        .celebration-unicorn *::before,
        .celebration-unicorn *::after {
          box-sizing: inherit;
        }

        .celebration-unicorn .unicorn-container {
          display: flex;
          justify-content: center;
        }

        .celebration-unicorn .unicorn {
          margin-top: 50px;
          margin-left: -130px;
        }
        .celebration-unicorn .unicorn .header {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .celebration-unicorn .unicorn .horn {
          position: relative;
          overflow: hidden;
          width: 40px;
          height: 50px;
        }
        .celebration-unicorn .unicorn .horn .lines-container {
          width: 20px;
          height: 50px;
          position: absolute;
          overflow: hidden;
          transform: skew(-20deg, 68deg);
          top: 25px;
          left: 10px;
          background: linear-gradient(105deg, #ffddab 0%, #ffddab 8%, #f4c598 9%, #f4c598 13%, #ffddab 14%, #ffddab 38%, #f4c598 39%, #f4c598 43%, #ffddab 44%);
        }
        .celebration-unicorn .unicorn .head {
          display: flex;
          justify-content: center;
          margin-left: 70px;
        }
        .celebration-unicorn .unicorn .face {
          display: flex;
          justify-content: center;
          margin-top: 30px;
          position: relative;
          z-index: 1;
        }
        .celebration-unicorn .unicorn .face .pink {
          z-index: 2;
          position: relative;
          width: 80px;
          height: 85px;
          background-color: #ffaeb0;
          border-radius: 20px 8px 8px 20px;
        }
        .celebration-unicorn .unicorn .face .pink::before {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          background-color: #ff545a;
          border-radius: 50%;
          top: 20px;
          left: 10px;
          box-shadow: 25px 0 #ff545a;
        }
        .celebration-unicorn .unicorn .face .pink::after {
          content: '';
          position: absolute;
          width: 55px;
          height: 40px;
          background-color: #ff545a;
          border-radius: 4px 4px 30px 30px;
          bottom: 5px;
          left: 11px;
        }
        .celebration-unicorn .unicorn .face .white {
          position: relative;
          width: 90px;
          height: 85px;
          background-color: #eeeeee;
          margin-left: -30px;
          border-bottom-right-radius: 35px;
          box-shadow: 0 11px #e1e1e1;
        }
        .celebration-unicorn .unicorn .face .white::before {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
          top: 20px;
          right: 30px;
          box-shadow: 3px 4px 0 7px #502e75;
        }
        .celebration-unicorn .unicorn .face .white::after {
          content: '';
          position: absolute;
          width: 14px;
          height: 35px;
          background-color: #ff545a;
          border-radius: 7px 7px 0 0;
          top: -35px;
          right: 4px;
          box-shadow: 0 0 0 4px #eeeeee;
        }
        .celebration-unicorn .unicorn .hair {
          position: relative;
          overflow: hidden;
          width: 230px;
          height: 180px;
          margin-left: -100px;
          border-top-left-radius: 30px;
        }
        .celebration-unicorn .unicorn .hair .inner-hair {
          position: relative;
          width: 230px;
          height: 18px;
          border-radius: 0 9px 9px 0;
          background: #ff2220;
          box-shadow: -15px 18px #ffae00, -15px 36px #ffe100, -12px 54px #85c900, -15px 72px #00b0ff, -8px 90px #8139df, -15px 108px #ff40e1, -6px 126px #ff2220, -15px 144px #ffae00, -8px 162px #ffe100, -8px 180px #85c900;
          animation: hair 2s linear infinite;
        }
        .celebration-unicorn .unicorn .hair .inner-hair::after {
          content: '';
          position: absolute;
          width: 50px;
          height: 18px;
          border-radius: 9px;
          right: 0;
          box-shadow: -12px 18px #00518a, 13px 54px #00518a, -6px 90px #00518a, 14px 126px #00518a, -7px 162px #00518a;
        }
        .celebration-unicorn .unicorn .neck {
          position: relative;
          width: 90px;
          height: 50px;
          background-color: #eeeeee;
          margin-left: -10px;
          margin-top: -95px;
        }
        .celebration-unicorn .unicorn .body {
          display: flex;
        }
        .celebration-unicorn .unicorn .main {
          position: relative;
          width: 300px;
          height: 150px;
          left: 200px;
          background: radial-gradient(circle at 250px 65%, #fff 0%, #fff 70px, #eeeeee 71px);
          border-bottom-left-radius: 50px;
          border-bottom-right-radius: 75px;
          border-top-right-radius: 75px;
        }
        .celebration-unicorn .unicorn .main::after {
          content: '';
          position: absolute;
          width: 40px;
          height: 40px;
          left: 70px;
          top: -20px;
          border-bottom-left-radius: 60px;
          border-bottom: 20px solid #eeeeee;
          border-left: 20px solid #eeeeee;
        }
        .celebration-unicorn .unicorn .main::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 70px;
          left: -20px;
          top: -20px;
          background-color: #00518a;
        }
        .celebration-unicorn .unicorn .tail {
          position: relative;
          width: 200px;
          height: 18px;
          z-index: -1;
          border-radius: 0 9px 9px 0;
          left: 100px;
          top: 20px;
          background: #ff2220;
          box-shadow: 0 18px #ffae00, 60px 36px #ffe100, 0 54px #85c900, -20px 72px #00b0ff;
          animation: tail 1.5s linear infinite;
        }
        .celebration-unicorn .unicorn .tail::after {
          content: '';
          position: absolute;
          width: 70px;
          height: 18px;
          border-radius: 9px;
          right: 0;
          box-shadow: 10px 18px #00518a, 10px 54px #00518a;
        }
        .celebration-unicorn .unicorn .tail::before {
          content: '';
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(220deg, #00518a 0%, #00518a 55%, transparent 56%);
          bottom: -140px;
          left: 10px;
        }
        .celebration-unicorn .unicorn .tail .inner-tail {
          position: absolute;
          width: 28px;
          height: 28px;
          background-color: transparent;
          border-bottom: 10px solid #00518a;
          border-left: 10px solid #00518a;
          right: 58px;
          top: 72px;
          border-bottom-left-radius: 30px;
        }
        .celebration-unicorn .unicorn .legs {
          position: relative;
          top: -50px;
        }
        .celebration-unicorn .unicorn .legs .leg {
          position: absolute;
          width: 80px;
          height: 80px;
          border-bottom: 35px solid;
          border-left: 35px solid;
          border-bottom-left-radius: 80px;
        }
        .celebration-unicorn .unicorn .legs .leg::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 35px;
          background-color: #ff5654;
          bottom: -35px;
          right: -20px;
          border-bottom-right-radius: 17.5px;
          border-top-right-radius: 17.5px;
        }
        .celebration-unicorn .unicorn .legs :nth-child(odd) { color: #cdd1d2; }
        .celebration-unicorn .unicorn .legs :nth-child(even) { color: #fff; }
        .celebration-unicorn .unicorn .legs :nth-child(1) {
          transform: rotate(90deg);
          top: -30px;
          left: 200px;
          z-index: -1;
          transform-origin: top left;
          animation: leg1 1s ease-in-out infinite alternate;
        }
        .celebration-unicorn .unicorn .legs :nth-child(2) {
          transform: rotate(40deg);
          top: -10px;
          left: 250px;
          transform-origin: top left;
          animation: leg2 1s 0.15s ease-in-out infinite alternate;
        }
        .celebration-unicorn .unicorn .legs :nth-child(2)::before {
          content: '';
          position: absolute;
          width: 35px;
          height: 20px;
          background-color: #fff;
          top: -20px;
          left: -35px;
          border-top-right-radius: 17.5px;
          border-top-left-radius: 17.5px;
        }
        .celebration-unicorn .unicorn .legs :nth-child(3) {
          transform: rotate(30deg);
          top: -15px;
          left: 352px;
          z-index: -1;
          transform-origin: top left;
          animation: leg3 1s ease-in-out infinite alternate;
        }
        .celebration-unicorn .unicorn .legs :nth-child(4) {
          transform: rotate(60deg);
          top: -5px;
          left: 400px;
          transform-origin: top left;
          animation: leg4 1s ease-in-out infinite alternate;
        }

        .celebration-unicorn .rainbow-container { display: flex; justify-content: center; }
        .celebration-unicorn .rainbow-container .rainbow {
          z-index: -2;
          position: relative;
          width: 770px;
          height: 300px;
          overflow: hidden;
        }
        .celebration-unicorn .rainbow-container .rainbow::after {
          content: '';
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 200px;
          background-color: #00518a;
          bottom: -350px;
          transform: translateX(-50%);
          left: 50%;
          box-shadow: 0 0 0 30px #ff40e1, 0 0 0 60px #8139df, 0 0 0 90px #00b0ff, 0 0 0 120px #85c900, 0 0 0 150px #ffe100, 0 0 0 180px #ffae00, 0 0 0 210px #ff2220;
        }
        .celebration-unicorn .rainbow-container .rainbow::before {
          content: '';
          position: absolute;
          width: 820px;
          height: 820px;
          z-index: 1;
          top: 39px;
          left: -26px;
          border-radius: 50%;
          background-image: radial-gradient(#00518a 0, #00518a 200px, transparent 60px), conic-gradient(transparent 10%, rgba(255, 255, 255, 0.3) 30%, transparent 40%);
          animation: rotate linear infinite 2.5s;
        }

        .celebration-unicorn .bg { position: relative; }
        .celebration-unicorn .bg .clouds .cloud {
          z-index: -1;
          position: absolute;
          width: 120px;
          height: 20px;
          background-color: #fff;
          border-radius: 10px;
          transform: scale(0.6);
          box-shadow: 0 20px #fff, 0 40px #fff, 0 60px #fff, 0 80px #fff;
        }
        .celebration-unicorn .bg .clouds .cloud::after {
          content: '';
          position: absolute;
          width: 80px;
          height: 20px;
          top: 20px;
          left: -30px;
          background-color: #00518a;
          border-radius: 10px;
          box-shadow: 100px 0 #00518a, -20px 40px #00518a, 80px 40px #00518a;
        }
        .celebration-unicorn .bg .clouds .cloud.alt::before {
          content: '';
          position: absolute;
          width: 40px;
          height: 20px;
          background-color: #fff;
          right: -55px;
          border-radius: 10px;
        }
        .celebration-unicorn .bg .clouds .cloud.bot { transform: scale(1, -1) scale(0.6); }
        .celebration-unicorn .bg .clouds :nth-child(1) { top: 30px; left: -20%; animation: clouds 6s linear infinite; }
        .celebration-unicorn .bg .clouds :nth-child(2) { top: 450px; left: -60%; animation: clouds 7s linear infinite; z-index: -2; }

        .celebration-unicorn .bg .stars { position: relative; }
        .celebration-unicorn .bg .stars :nth-child(1) { top: 30px; left: 20%; animation: star1 5s linear infinite; }
        .celebration-unicorn .bg .stars :nth-child(2) { top: 90px; left: 70%; animation: star2 5s 2s linear infinite alternate; }
        .celebration-unicorn .bg .stars :nth-child(3) { top: 240px; left: 10%; animation: star1 5s 1.3s ease-in infinite; }
        .celebration-unicorn .bg .stars :nth-child(4) { top: 220px; left: 80%; animation: star1 5.5s 2.1s ease-out infinite; }
        .celebration-unicorn .bg .stars :nth-child(5) { top: 320px; left: 15%; animation: star1 5.5s 2.1s ease-out infinite alternate; }
        .celebration-unicorn .bg .stars :nth-child(6) { top: 380px; left: 85%; animation: star1 4s linear infinite; }
        .celebration-unicorn .bg .stars :nth-child(7) { top: 500px; left: 5%; animation: star2 4.8s linear infinite alternate; }
        .celebration-unicorn .bg .stars :nth-child(8) { top: 520px; left: 90%; animation: star2 5s 1s linear infinite; }
        .celebration-unicorn .bg .stars :nth-child(9) { top: 220px; left: 30%; animation: star2 5s 4s linear infinite; }
        .celebration-unicorn .bg .stars :nth-child(10) { top: 70px; left: 92%; animation: star2 5.5s 0.3s ease-in-out alternate infinite; }
        .celebration-unicorn .bg .stars .star {
          position: absolute;
          width: 6px;
          height: 20px;
          background-color: #f8e545;
          border-radius: 3px;
        }
        .celebration-unicorn .bg .stars .star::after {
          content: '';
          position: absolute;
          width: 6px;
          height: 20px;
          background-color: #f8e545;
          border-radius: 3px;
          transform: rotate(90deg);
        }

        .celebration-unicorn .bg .planets { position: relative; }
        .celebration-unicorn .bg .planets :nth-child(1) { top: 130px; left: 20%; animation: planet1 5s linear infinite; }
        .celebration-unicorn .bg .planets :nth-child(2) { top: 190px; left: 70%; animation: planet1 5s 0.6s linear infinite alternate; }
        .celebration-unicorn .bg .planets :nth-child(3) { top: 140px; left: 1%; animation: planet1 4.8s 0.5s linear infinite; }
        .celebration-unicorn .bg .planets :nth-child(4) { top: 320px; left: 90%; animation: planet1 4.8s 0.2s ease-in infinite alternate; }
        .celebration-unicorn .bg .planets :nth-child(5) { top: 220px; left: 18%; animation: planet1 4.8s 0.8s ease-in infinite; }
        .celebration-unicorn .bg .planets :nth-child(6) { top: 20px; left: 85%; animation: planet1 5s 1.8s ease-in infinite; }
        .celebration-unicorn .bg .planets :nth-child(7) { top: 450px; left: 32%; animation: planet1 6s ease-in infinite; }
        .celebration-unicorn .bg .planets :nth-child(8) { top: 490px; left: 80%; animation: planet1 5.5s ease-in infinite; }
        .celebration-unicorn .bg .planets :nth-child(9) { top: 5px; left: 50%; animation: planet1 4.8s 1s ease-in infinite alternate; }
        .celebration-unicorn .bg .planets :nth-child(10) { top: 25px; left: 5%; animation: planet1 4s 0.7s ease-out infinite; }
        .celebration-unicorn .bg .planets .planet {
          position: absolute;
          width: 6px;
          height: 6px;
          background-color: #fafafa;
          border-radius: 3px;
        }

        @keyframes clouds { 100% { left: 100%; } }
        @keyframes star1 {
          40% { opacity: 30%; transform: scale(0.9); }
          36%, 44% { opacity: 100%; transform: scale(1); }
        }
        @keyframes star2 {
          40% { opacity: 20%; transform: scale(1.2); }
          36%, 44% { opacity: 100%; transform: scale(1); }
        }
        @keyframes planet1 {
          40% { box-shadow: 0 0 10px 2px white; opacity: 70%; }
          30%, 50% { box-shadow: none; opacity: 100%; }
        }
        @keyframes leg1 { to { transform: rotate(50deg); } }
        @keyframes leg2 { to { transform: rotate(80deg); } }
        @keyframes leg3 { to { transform: rotate(70deg); } }
        @keyframes leg4 { to { transform: rotate(20deg); } }
        @keyframes hair {
          14% { box-shadow: -15px 18px #ffe100, -15px 36px #85c900, -12px 54px #00b0ff, -15px 72px #8139df, -8px 90px #ff40e1, -15px 108px #ff2220, -6px 126px #ffae00, -15px 144px #ffe100, -8px 162px #85c900, -8px 180px #00b0ff; }
          28% { box-shadow: -15px 18px #85c900, -15px 36px #00b0ff, -12px 54px #8139df, -15px 72px #ff40e1, -8px 90px #ff2220, -15px 108px #ffae00, -6px 126px #ffe100, -15px 144px #85c900, -8px 162px #00b0ff, -8px 180px #8139df; }
          42% { box-shadow: -15px 18px #00b0ff, -15px 36px #8139df, -12px 54px #ff40e1, -15px 72px #ff2220, -8px 90px #ffae00, -15px 108px #ffe100, -6px 126px #85c900, -15px 144px #00b0ff, -8px 162px #8139df, -8px 180px #ff40e1; }
          56% { box-shadow: -15px 18px #8139df, -15px 36px #ff40e1, -12px 54px #ff2220, -15px 72px #ffae00, -8px 90px #ffe100, -15px 108px #85c900, -6px 126px #00b0ff, -15px 144px #8139df, -8px 162px #ff40e1, -8px 180px #ff2220; }
          70% { box-shadow: -15px 18px #ff40e1, -15px 36px #ff2220, -12px 54px #ffae00, -15px 72px #ffe100, -8px 90px #85c900, -15px 108px #00b0ff, -6px 126px #8139df, -15px 144px #ff40e1, -8px 162px #ff2220, -8px 180px #ffae00; }
          85% { box-shadow: -15px 18px #ff2220, -15px 36px #ffae00, -12px 54px #ffe100, -15px 72px #85c900, -8px 90px #00b0ff, -15px 108px #8139df, -6px 126px #ff40e1, -15px 144px #ff2220, -8px 162px #ffae00, -8px 180px #ffe100; }
          100% { box-shadow: -15px 18px #ffae00, -15px 36px #ffe100, -12px 54px #85c900, -15px 72px #00b0ff, -8px 90px #8139df, -15px 108px #ff40e1, -6px 126px #ff2220, -15px 144px #ffae00, -8px 162px #ffe100, -8px 180px #85c900; }
        }
        @keyframes tail {
          20% { background: #ffae00; box-shadow: 0 18px #ffe100, 60px 36px #85c900, 0 54px #00b0ff, -20px 72px #ff2220; }
          40% { background: #ffe100; box-shadow: 0 18px #85c900, 60px 36px #00b0ff, 0 54px #ff2220, -20px 72px #ffae00; }
          60% { background: #85c900; box-shadow: 0 18px #00b0ff, 60px 36px #ff2220, 0 54px #ffae00, -20px 72px #ffe100; }
          80% { background: #00b0ff; box-shadow: 0 18px #ff2220, 60px 36px #ffae00, 0 54px #ffe100, -20px 72px #85c900; }
        }
        @keyframes rotate { 100% { transform: rotate(1turn); } }
      `}</style>

      <div className="celebration-unicorn-overlay" aria-label="CodePen Einhorn Animation" role="img">
        <div className="celebration-unicorn-wrapper">
          <div className="celebration-unicorn">
            <div className="bg">
              <div className="clouds">
                <div className="cloud" />
                <div className="cloud alt bot" />
              </div>
              <div className="stars">
                {stars.map((_, index) => (
                  <div key={`star-${index}`} className="star" />
                ))}
              </div>
              <div className="planets">
                {planets.map((_, index) => (
                  <div key={`planet-${index}`} className="planet" />
                ))}
              </div>
            </div>

            <div className="unicorn-container">
              <div className="unicorn">
                <div className="header">
                  <div className="horn">
                    <div className="lines-container" />
                  </div>
                  <div className="head">
                    <div className="face">
                      <div className="pink" />
                      <div className="white" />
                    </div>
                    <div className="hair">
                      <div className="inner-hair" />
                    </div>
                  </div>
                  <div className="neck" />
                </div>
                <div className="body">
                  <div className="main" />
                  <div className="tail">
                    <div className="inner-tail" />
                  </div>
                </div>
                <div className="legs">
                  <div className="leg" />
                  <div className="leg" />
                  <div className="leg" />
                  <div className="leg" />
                </div>
              </div>
            </div>

            <div className="rainbow-container">
              <div className="rainbow" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
