export type HarbourSource = { label: string; url: string };
export type MarinaGuide = {
  name: string;
  description: string;
  facilities: string[];
  vhf: string;
  phone: string;
  website: string;
};
export type HarbourGuideData = {
  id: string;
  name: string;
  checkedAt: string;
  introduction: string;
  authority: HarbourSource;
  radio: string;
  briefing: string[];
  sources: HarbourSource[];
  marinas: MarinaGuide[];
};

// Curated, source-checked information. This is not a live port/berth feed.
export const harbours: HarbourGuideData[] = [
  {
    id: "cowes",
    name: "Cowes & River Medina",
    checkedAt: "2026-11-01",
    introduction:
      "A busy Solent harbour with visitor berthing on both sides of the River Medina.",
    authority: {
      label: "Cowes Harbour Commission",
      url: "https://www.cowes.co.uk/safety-navigation/navigation/",
    },
    radio: "Cowes Harbour Radio · VHF 69 (not a 24-hour service)",
    briefing: [
      "Read the current harbour notices for works, buoy changes and event activity before departure.",
      "Review the harbour authority’s approach, breakwater and chain-ferry guidance alongside your current charts.",
      "Arrange visitor berthing with the marina. Fuel, shore facilities and opening hours should be confirmed directly.",
    ],
    sources: [
      {
        label: "Current Cowes Notices to Mariners",
        url: "https://www.cowes.co.uk/lntms/",
      },
      {
        label: "Official navigation guidance",
        url: "https://www.cowes.co.uk/safety-navigation/navigation/",
      },
      {
        label: "Harbour weather & tide information",
        url: "https://www.cowes.co.uk/harbour-information/weather-tide-information/",
      },
    ],
    marinas: [
      {
        name: "Shepards Marina",
        description:
          "Walk-ashore visitor berthing close to central Cowes. Ask the operator about late arrival arrangements.",
        facilities: ["Water & power", "Showers", "Waste & recycling", "Wi-Fi"],
        vhf: "80",
        phone: "+44 1983 297821",
        website: "https://www.cowes.co.uk/harbour-information/shepards-marina/",
      },
      {
        name: "East Cowes Marina",
        description:
          "Visitor marina on the east bank of the Medina, with waterside dining and laundry.",
        facilities: ["Electricity", "Showers", "Laundry", "Restaurant"],
        vhf: "80",
        phone: "+44 1983 293983",
        website: "https://www.premiermarinas.com/marinas/east-cowes-marina",
      },
    ],
  },
  {
    id: "gosport",
    name: "Gosport & Portsmouth Harbour",
    checkedAt: "2026-11-01",
    introduction:
      "A commercial, naval and leisure harbour, with Gosport marinas on its western side.",
    authority: {
      label: "King’s Harbour Master Portsmouth",
      url: "https://www.royalnavy.mod.uk/khm/portsmouth",
    },
    radio:
      "King’s Harbour Master · VHF 11; marina reception is a separate channel",
    briefing: [
      "Consult KHM’s Small Boat Channel rules before arrival; harbour traffic and cross-tides need particular attention.",
      "Read the separate crossing rules if visiting Gunwharf Quays or Town Camber. Use the official instructions for permission and timing.",
      "Pre-book visitor berthing where possible and confirm your vessel’s dimensions, arrival arrangements and facilities with the marina.",
    ],
    sources: [
      {
        label: "KHM notices & harbour directions",
        url: "https://www.royalnavy.mod.uk/khm/portsmouth",
      },
      {
        label: "Official harbour entry rules",
        url: "https://www.royalnavy.mod.uk/khm/portsmouth/safety-and-regulations/regulations/entering-the-harbour",
      },
      {
        label: "Official harbour crossing rules",
        url: "https://www.royalnavy.mod.uk/khm/portsmouth/safety-and-regulations/regulations/crossing-the-harbour",
      },
      {
        label: "Gosport marina tide information",
        url: "https://www.premiermarinas.com/marinas/gosport-marina/gosport-tides",
      },
    ],
    marinas: [
      {
        name: "Gosport Marina",
        description:
          "Visitor berthing near the harbour entrance with Endeavour Quay boatyard and an on-site chandlery.",
        facilities: ["Fuel", "Water & electricity", "Pump-out", "Boatyard"],
        vhf: "80",
        phone: "+44 23 9252 4811",
        website: "https://www.premiermarinas.com/marinas/gosport-marina",
      },
      {
        name: "Haslar Marina",
        description:
          "Marina in Haslar Lake on the Gosport side of Portsmouth Harbour. Operator lists 24-hour reception.",
        facilities: ["Visitor enquiries", "24-hour reception"],
        vhf: "80",
        phone: "+44 23 9260 1201",
        website: "https://www.premiermarinas.com/marinas/haslar-marina",
      },
    ],
  },
];
