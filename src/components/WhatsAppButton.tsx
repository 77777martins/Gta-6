import { whatsappLink } from "@/config/store";
import { ChatIcon } from "./icons";

export function WhatsAppButton({ message = "Olá! Tenho uma dúvida sobre a compra do GTA VI." }: { message?: string }) {
  const href = whatsappLink(message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o atendimento pelo WhatsApp"
      className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-3.5 text-sm font-bold text-black shadow-lg shadow-black/40 transition hover:scale-105"
    >
      <ChatIcon width={20} height={20} />
      <span className="hidden sm:inline">Atendimento</span>
    </a>
  );
}
