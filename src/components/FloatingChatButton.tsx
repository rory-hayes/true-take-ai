import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FloatingChatButton = () => {
  return (
    <Button
      size="lg"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
      onClick={() => {
        // Placeholder for future ChatKit integration
        console.log("Chat button clicked - ChatKit to be integrated");
      }}
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
};

export default FloatingChatButton;
