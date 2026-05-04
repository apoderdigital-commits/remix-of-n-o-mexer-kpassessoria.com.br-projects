import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";

export function SupportWhatsAppButton() {
  const { pathname } = useLocation();
  // Hide on squad dashboard (and admin)
  if (pathname.startsWith("/squad")) return null;

  const href = "https://w.app/kpassessoriadashsuporte";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o suporte no WhatsApp"
      title="Suporte via WhatsApp"
      className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1fb755] text-white shadow-lg shadow-green-900/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-500/30 px-4 py-3"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-ping opacity-60" aria-hidden="true" />
      <MessageCircle className="relative h-5 w-5" fill="currentColor" />
      <span className="relative hidden sm:inline text-sm font-semibold whitespace-nowrap">
        Suporte
      </span>
    </a>
  );
}
