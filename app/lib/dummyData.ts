/** Dummy data for the HOI Neural dashboard by Highon Innovation. */

export const kpis = [
  { label: "Active Clients",    value: "1,284", delta: "+12.4%", trend: "up" as const },
  { label: "Neural Deployments", value: "37",   delta: "+3",     trend: "up" as const },
  { label: "Monthly Revenue",   value: "$184.2K", delta: "+8.1%", trend: "up" as const },
  { label: "Model Utilization", value: "87%",   delta: "-1.2%",  trend: "down" as const },
];

export const leads = [
  { id: 1, name: "Aether Labs",        owner: "Priya S.", stage: "Qualified",   value: "$42,000",  score: 92 },
  { id: 2, name: "Nimbus Robotics",    owner: "Karan M.", stage: "Proposal",    value: "$118,000", score: 88 },
  { id: 3, name: "Vega Biotech",       owner: "Anita R.", stage: "Discovery",   value: "$24,500",  score: 74 },
  { id: 4, name: "Helios Energy",      owner: "Dev T.",   stage: "Negotiation", value: "$210,000", score: 81 },
  { id: 5, name: "Orbital Finance",    owner: "Sana K.",  stage: "Qualified",   value: "$67,300",  score: 69 },
  { id: 6, name: "Quanta Mobility",    owner: "Rahul J.", stage: "Proposal",    value: "$95,000",  score: 77 },
];

export const projects = [
  { id: 1, name: "Neural CRM Copilot",       client: "Aether Labs",     progress: 72, status: "On Track" },
  { id: 2, name: "Vision Inference Cluster", client: "Nimbus Robotics", progress: 41, status: "At Risk" },
  { id: 3, name: "Clinical LLM Pipeline",    client: "Vega Biotech",    progress: 88, status: "On Track" },
  { id: 4, name: "Grid Forecast Model",      client: "Helios Energy",   progress: 55, status: "On Track" },
  { id: 5, name: "Fraud Neural Net v2",      client: "Orbital Finance", progress: 23, status: "Planning" },
];

export const revenue = {
  total: "$1.84M",
  target: "$2.10M",
  months: [
    { m: "Jan", v: 120 }, { m: "Feb", v: 142 }, { m: "Mar", v: 158 },
    { m: "Apr", v: 171 }, { m: "May", v: 165 }, { m: "Jun", v: 184 },
    { m: "Jul", v: 192 }, { m: "Aug", v: 178 }, { m: "Sep", v: 201 },
    { m: "Oct", v: 215 }, { m: "Nov", v: 198 }, { m: "Dec", v: 224 },
  ],
};

export const team = [
  { id: 1, name: "Priya Sharma", role: "Head of Growth",        load: 82, status: "active" },
  { id: 2, name: "Karan Mehta",  role: "Neural Solutions Lead", load: 64, status: "active" },
  { id: 3, name: "Anita Rao",    role: "ML Research Lead",      load: 91, status: "active" },
  { id: 4, name: "Dev Tiwari",   role: "Account Executive",     load: 47, status: "away"   },
  { id: 5, name: "Sana Khan",    role: "Product Designer",      load: 73, status: "active" },
];

export const aiActions = [
  { id: 1, title: "Follow up with Helios Energy",   reason: "No contact in 9 days",    priority: "high"   },
  { id: 2, title: "Escalate Nimbus project risk",   reason: "Milestone slipped 2 wks", priority: "high"   },
  { id: 3, title: "Send proposal to Orbital",       reason: "Stage ready",             priority: "medium" },
  { id: 4, title: "Rebalance Anita's workload",     reason: "Utilization > 90%",       priority: "medium" },
];
