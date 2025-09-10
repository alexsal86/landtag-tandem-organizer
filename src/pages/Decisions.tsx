import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { DecisionOverview } from "@/components/task-decisions/DecisionOverview";

export default function Decisions() {
  const [currentSection, setCurrentSection] = useState("decisions");

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        activeSection={currentSection} 
        onSectionChange={setCurrentSection} 
      />
      <main className="container mx-auto px-4 py-8">
        <DecisionOverview />
      </main>
    </div>
  );
}