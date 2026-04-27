import { MessageCircle } from "lucide-react";

const SUPPORT_PHONE = "5581997172434";
const DEFAULT_MESSAGE = "Olá! Preciso de suporte com o dashboard.";

export function SupportWhatsAppButton() {
  const href = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

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
