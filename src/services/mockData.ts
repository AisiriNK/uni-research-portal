// Mock cluster data for testing when backend is not available
export const MOCK_CLUSTER_DATA = {
  nodes: [
    {
      id: "root",
      label: "Research Topics",
      level: 0,
      parent_id: null,
      papers: [],
      paper_count: 5
    },
    {
      id: "cluster1",
      label: "Machine Learning",
      level: 1,
      parent_id: "root",
      papers: [
        {
          id: "paper1",
          title: "Deep Learning Advances",
          abstract: "This paper explores recent advances in deep learning technologies...",
          authors: [{ id: "author1", name: "John Smith" }],
          year: 2023,
          citation_count: 123,
          doi: "10.1234/example"
        }
      ],
      paper_count: 2
    },
    {
      id: "cluster2",
      label: "Natural Language Processing",
      level: 1,
      parent_id: "root",
      papers: [
        {
          id: "paper2",
          title: "Transformer Models in NLP",
          abstract: "This paper discusses the application of transformer models in natural language processing...",
          authors: [{ id: "author2", name: "Jane Doe" }],
          year: 2022,
          citation_count: 87,
          doi: "10.1234/example2"
        }
      ],
      paper_count: 2
    },
    {
      id: "subcluster1",
      label: "Neural Networks",
      level: 2,
      parent_id: "cluster1",
      papers: [
        {
          id: "paper3",
          title: "Neural Network Architectures",
          abstract: "A comprehensive study of neural network architectures and their applications...",
          authors: [{ id: "author3", name: "Robert Johnson" }],
          year: 2021,
          citation_count: 65,
          doi: "10.1234/example3"
        }
      ],
      paper_count: 1
    }
  ],
  edges: [
    { from_node: "root", to_node: "cluster1" },
    { from_node: "root", to_node: "cluster2" },
    { from_node: "cluster1", to_node: "subcluster1" }
  ]
};
