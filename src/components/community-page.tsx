import { identity } from "deso-protocol";
import { useStore } from "../store";
import { CommunityTab } from "./community-tab";

const CommunityPage = () => {
  const { appUser } = useStore();

  const handleLogin = () => {
    identity.login().catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#0F1520] text-white flex flex-col relative overflow-hidden">
      {/* Background orbs */}
      <div className="landing-orb w-[500px] h-[500px] bg-[#34F080] -top-[200px] -left-[100px] opacity-[0.04]" />
      <div className="landing-orb w-[400px] h-[400px] bg-[#20E0AA] -bottom-[150px] -right-[80px] opacity-[0.03]" />

      {/* Navigation bar */}
      <nav className="w-full flex items-center justify-between h-[60px] relative z-10 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5 shrink-0">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <img
              src="/ChatOn-Logo-Small.png"
              alt="ChatOn"
              className="w-8 h-8 rounded-lg"
            />
            <span className="text-sm font-black tracking-wider text-white/90">
              CHATON
            </span>
          </a>
          <div className="flex items-center gap-3">
            {appUser ? (
              <a
                href="/"
                className="px-5 py-2.5 text-gray-300 hover:text-white text-xs font-black transition-colors"
              >
                BACK TO CHATS
              </a>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="px-5 py-2.5 text-gray-300 hover:text-white text-xs font-black transition-colors cursor-pointer"
                >
                  LOG IN
                </button>
                <button
                  onClick={handleLogin}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black text-xs font-black rounded-full hover:brightness-110 transition-all cursor-pointer"
                >
                  SIGN UP
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="w-full max-w-3xl mx-auto px-6 pt-10 pb-2 relative z-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Community Chats</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Discover and join public group chats on the DeSo blockchain
        </p>
      </div>

      {/* Community listings */}
      <div className="flex-1 w-full max-w-3xl mx-auto relative z-10">
        <CommunityTab fullPage />
      </div>
    </div>
  );
};

export default CommunityPage;
