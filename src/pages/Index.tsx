import { useState } from "react"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { ResearchHub } from "@/components/ResearchHub"
import { AIReportFormatter } from "@/components/AIReportFormatter"
import { ApprovalsPrinting } from "@/components/ApprovalsPrinting"
import { NoDueClearance } from "@/components/NoDueClearance"
import { PaperSearchCluster } from "@/components/PaperSearchCluster"

const Index = () => {
  const [activeSection, setActiveSection] = useState("research")

  const renderContent = () => {
    switch (activeSection) {
      case "research":
        return <ResearchHub />
      case "clustering":
        return <PaperSearchCluster />
      case "formatter":
        return <AIReportFormatter />
      case "approvals":
        return <ApprovalsPrinting />
      case "clearance":
        return <NoDueClearance />
      default:
        return <ResearchHub />
    }
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="university-portal-theme">
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
          <main className="flex-1 overflow-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Index;

