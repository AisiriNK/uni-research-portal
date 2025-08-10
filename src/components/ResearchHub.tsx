import { useState, useCallback } from "react"
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Eye, ChevronDown, ChevronRight } from "lucide-react"

// Sample research papers data
const researchPapers = {
  "Healthcare": [
    {
      id: 1,
      title: "AI-Driven Diagnostic Systems for Early Disease Detection",
      summary: "This research explores machine learning algorithms for predicting diseases from medical imaging data, achieving 94% accuracy in early-stage cancer detection.",
      authors: ["Dr. Sarah Johnson", "Prof. Michael Chen"],
      year: 2024
    },
    {
      id: 2,
      title: "Deep Learning in Medical Image Analysis",
      summary: "A comprehensive study on convolutional neural networks for automated medical image interpretation and diagnosis assistance.",
      authors: ["Dr. Emily Rodriguez", "Dr. James Kim"],
      year: 2023
    }
  ],
  "Robotics": [
    {
      id: 3,
      title: "Autonomous Navigation in Dynamic Environments",
      summary: "Development of adaptive algorithms for robot navigation in crowded and unpredictable environments using reinforcement learning.",
      authors: ["Prof. Alex Thompson", "Dr. Lisa Wang"],
      year: 2024
    }
  ],
  "IoT": [
    {
      id: 4,
      title: "Smart City Infrastructure with IoT Integration",
      summary: "Implementation of IoT sensors for urban management, focusing on traffic optimization and environmental monitoring.",
      authors: ["Dr. Robert Kumar", "Prof. Anna Patel"],
      year: 2023
    }
  ]
}

// Tree structure for departments and topics
const treeStructure = {
  "Computer Science": {
    "Artificial Intelligence": ["Healthcare", "Robotics", "Natural Language Processing"],
    "Software Engineering": ["Web Development", "Mobile Apps", "DevOps"],
    "Data Science": ["Machine Learning", "Big Data", "Analytics"]
  },
  "ECE": {
    "Signal Processing": ["Digital Signal Processing", "Image Processing", "Audio Processing"],
    "Communications": ["Wireless Networks", "5G Technology", "Satellite Communication"],
    "Embedded Systems": ["IoT", "Microcontrollers", "Real-time Systems"]
  },
  "EEE": {
    "Power Systems": ["Renewable Energy", "Smart Grid", "Power Electronics"],
    "Control Systems": ["Automation", "Process Control", "Robotics Control"],
    "Electronics": ["VLSI Design", "Analog Circuits", "Digital Electronics"]
  },
  "Mechanical": {
    "Thermodynamics": ["Heat Transfer", "Energy Systems", "HVAC"],
    "Manufacturing": ["3D Printing", "CNC Machining", "Quality Control"],
    "Fluid Mechanics": ["Aerodynamics", "Hydraulics", "Computational Fluid Dynamics"]
  },
  "Civil": {
    "Structural Engineering": ["Earthquake Engineering", "Bridge Design", "Building Analysis"],
    "Environmental": ["Water Treatment", "Air Quality", "Waste Management"],
    "Transportation": ["Traffic Engineering", "Urban Planning", "Highway Design"]
  }
}

interface TreeNodeProps {
  name: string
  level: number
  isExpanded: boolean
  onToggle: () => void
  onLeafClick?: (name: string) => void
  children?: React.ReactNode
}

function TreeNode({ name, level, isExpanded, onToggle, onLeafClick, children }: TreeNodeProps) {
  const hasChildren = children !== undefined
  const indentLevel = level * 20

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-2 px-3 hover:bg-accent rounded-lg cursor-pointer transition-colors`}
        style={{ paddingLeft: `${indentLevel + 12}px` }}
        onClick={hasChildren ? onToggle : () => onLeafClick?.(name)}
      >
        {hasChildren && (
          <div className="mr-2 w-4 h-4 flex items-center justify-center">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        )}
        <span className={`text-sm ${hasChildren ? 'font-medium' : ''} ${level === 0 ? 'text-academic-navy font-bold' : level === 1 ? 'text-academic-blue' : 'text-academic-gray'}`}>
          {name}
        </span>
        {!hasChildren && (
          <BookOpen size={14} className="ml-2 text-academic-gray" />
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {children}
        </div>
      )}
    </div>
  )
}

export function ResearchHub() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName)
    } else {
      newExpanded.add(nodeName)
    }
    setExpandedNodes(newExpanded)
  }

  const handleLeafClick = (topicName: string) => {
    setSelectedTopic(topicName)
  }

  const renderTree = () => {
    return Object.entries(treeStructure).map(([department, topics]) => (
      <TreeNode
        key={department}
        name={department}
        level={0}
        isExpanded={expandedNodes.has(department)}
        onToggle={() => toggleNode(department)}
      >
        {Object.entries(topics).map(([category, subtopics]) => (
          <TreeNode
            key={category}
            name={category}
            level={1}
            isExpanded={expandedNodes.has(category)}
            onToggle={() => toggleNode(category)}
          >
            {subtopics.map((subtopic) => (
              <TreeNode
                key={subtopic}
                name={subtopic}
                level={2}
                isExpanded={false}
                onToggle={() => {}}
                onLeafClick={handleLeafClick}
              />
            ))}
          </TreeNode>
        ))}
      </TreeNode>
    ))
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Research Hub</h2>
          <p className="text-academic-gray">
            Explore research topics across departments and discover relevant papers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Tree Structure */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Research Areas</CardTitle>
                <CardDescription>
                  Click to expand departments and select research topics
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto h-full">
                {renderTree()}
              </CardContent>
            </Card>
          </div>

          {/* Research Papers */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedTopic ? `Research Papers - ${selectedTopic}` : "Select a Research Topic"}
                </CardTitle>
                <CardDescription>
                  {selectedTopic 
                    ? "Browse relevant research papers and identify research gaps"
                    : "Choose a topic from the research tree to view related papers"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto h-full">
                {selectedTopic && researchPapers[selectedTopic as keyof typeof researchPapers] ? (
                  <div className="space-y-4">
                    {researchPapers[selectedTopic as keyof typeof researchPapers].map((paper) => (
                      <Card key={paper.id} className="border border-border hover:shadow-card transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-academic-navy leading-tight">
                              {paper.title}
                            </h3>
                            <Badge variant="secondary" className="ml-2">
                              {paper.year}
                            </Badge>
                          </div>
                          <p className="text-sm text-academic-gray mb-3 leading-relaxed">
                            {paper.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Authors: {paper.authors.join(", ")}
                            </div>
                            <Button size="sm" variant="outline">
                              <Eye className="mr-2 h-4 w-4" />
                              View Gaps
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-academic-gray">
                    <div className="text-center">
                      <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select a research topic to view related papers</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}