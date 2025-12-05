import { useState } from "react"
import { 
  BookOpen, 
  FileText, 
  CheckCircle, 
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Network
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Research Hub", href: "#research", icon: BookOpen },
  { name: "Paper Clustering", href: "#clustering", icon: Network },
  { name: "AI Report Formatter", href: "#formatter", icon: FileText },
  { name: "No-Due Clearance", href: "#approvals", icon: CheckCircle },
  { name: "Report Submission", href: "#clearance", icon: ClipboardCheck },
]

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn(
      "flex h-screen bg-card border-r border-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <h2 className="text-lg font-semibold text-academic-navy">Navigation</h2>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = activeSection === item.href.slice(1)
            return (
              <button
                key={item.name}
                onClick={() => onSectionChange(item.href.slice(1))}
                className={cn(
                  "w-full flex items-center p-3 rounded-lg transition-all duration-200",
                  "hover:bg-academic-light-gray hover:shadow-card",
                  isActive 
                    ? "bg-gradient-primary text-white shadow-elevated" 
                    : "text-academic-gray hover:text-academic-navy"
                )}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="ml-3 text-sm font-medium">{item.name}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}