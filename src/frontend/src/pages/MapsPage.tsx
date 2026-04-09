// Speech Recognition type shims
interface SpeechRecognitionResultEntry {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResultEntry[];
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, Mic, Navigation2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import PageTransition from "../components/PageTransition";

// Fix Leaflet default icon paths (Vite/React issue)
(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl =
  undefined;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ───────────────────────────────────────────────────────────────────
type BudgetStatus = "under" | "near" | "over";
type FilterCategory =
  | "All"
  | "Food"
  | "Coffee"
  | "Grocery"
  | "Shopping"
  | "Healthcare"
  | "Transport"
  | "Entertainment";

interface Place {
  id: number;
  name: string;
  category: FilterCategory;
  emoji: string;
  avgCost: number;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  distance?: string;
  budgetStatus?: BudgetStatus;
}

// ─── Budget Pills ─────────────────────────────────────────────────────────────
const BUDGET_PILLS = [
  { label: "₹0–100", value: 100 },
  { label: "₹101–200", value: 200 },
  { label: "₹201–500", value: 500 },
  { label: "₹501–1k", value: 1000 },
  { label: "₹1k+", value: 9999 },
];

const CATEGORIES: FilterCategory[] = [
  "All",
  "Food",
  "Coffee",
  "Grocery",
  "Shopping",
  "Healthcare",
  "Transport",
  "Entertainment",
];

const CATEGORY_EMOJIS: Record<FilterCategory, string> = {
  All: "🗺️",
  Food: "🍽️",
  Coffee: "☕",
  Grocery: "🛒",
  Shopping: "🛍️",
  Healthcare: "🏥",
  Transport: "🚌",
  Entertainment: "🎭",
};

// ─── Places Data (33 places around Chennai) ──────────────────────────────────
const BASE_PLACES: Omit<Place, "distance" | "budgetStatus">[] = [
  {
    id: 1,
    name: "Murugan Idli Shop",
    category: "Food",
    emoji: "🍽️",
    avgCost: 80,
    description:
      "Famous for fluffy idlis and crispy dosas with sambar and chutneys.",
    tags: ["Breakfast", "South Indian", "Vegetarian"],
    lat: 13.0567,
    lng: 80.248,
  },
  {
    id: 2,
    name: "Saravana Bhavan",
    category: "Food",
    emoji: "🍽️",
    avgCost: 150,
    description:
      "Iconic South Indian restaurant chain with full meals and tiffin.",
    tags: ["Meals", "Thali", "Pure Veg"],
    lat: 13.0712,
    lng: 80.2612,
  },
  {
    id: 3,
    name: "Annachi Mess",
    category: "Food",
    emoji: "🍽️",
    avgCost: 90,
    description:
      "Local mess with rice, sambar, rasam and curry — pure comfort food.",
    tags: ["Mess", "Budget", "Home-style"],
    lat: 13.0923,
    lng: 80.2734,
  },
  {
    id: 4,
    name: "Buhari Hotel",
    category: "Food",
    emoji: "🍽️",
    avgCost: 220,
    description:
      "Classic Chennai restaurant known for Chicken 65 and biriyani.",
    tags: ["Non-Veg", "Biriyani", "Classic"],
    lat: 13.0634,
    lng: 80.2521,
  },
  {
    id: 5,
    name: "Hot Chips",
    category: "Food",
    emoji: "🍽️",
    avgCost: 120,
    description:
      "Popular snack brand outlet offering murukku, mixture and sweets.",
    tags: ["Snacks", "Sweets", "Gift"],
    lat: 13.0445,
    lng: 80.2398,
  },
  {
    id: 6,
    name: "Junior Kuppanna",
    category: "Food",
    emoji: "🍽️",
    avgCost: 180,
    description: "Authentic Kongunadu cuisine with kari dosai and mutton kola.",
    tags: ["Kongunadu", "Non-Veg", "Authentic"],
    lat: 13.0789,
    lng: 80.2667,
  },
  {
    id: 7,
    name: "Amethyst Cafe",
    category: "Coffee",
    emoji: "☕",
    avgCost: 280,
    description:
      "Heritage bungalow café with garden seating, teas and pastries.",
    tags: ["Artisan", "Garden", "Brunch"],
    lat: 13.0534,
    lng: 80.2889,
  },
  {
    id: 8,
    name: "Starbucks T Nagar",
    category: "Coffee",
    emoji: "☕",
    avgCost: 350,
    description:
      "Premium coffee chain with seasonal drinks and cozy workspace.",
    tags: ["Premium", "Workspace", "Frappuccino"],
    lat: 13.1034,
    lng: 80.2876,
  },
  {
    id: 9,
    name: "Filter Kaapi Corner",
    category: "Coffee",
    emoji: "☕",
    avgCost: 60,
    description:
      "Traditional filter coffee in a steel tumbler — nothing beats it.",
    tags: ["Traditional", "Budget", "Filter Coffee"],
    lat: 13.0678,
    lng: 80.2345,
  },
  {
    id: 10,
    name: "Brew Room",
    category: "Coffee",
    emoji: "☕",
    avgCost: 200,
    description:
      "Specialty coffee roasters with cold brew, pour-over and AeroPress.",
    tags: ["Specialty", "Third Wave", "Cold Brew"],
    lat: 13.0812,
    lng: 80.2701,
  },
  {
    id: 11,
    name: "Spencer's Daily",
    category: "Grocery",
    emoji: "🛒",
    avgCost: 400,
    description:
      "Supermarket chain with fresh produce, dairy and household supplies.",
    tags: ["Supermarket", "Fresh Produce", "Daily Needs"],
    lat: 13.0512,
    lng: 80.2756,
  },
  {
    id: 12,
    name: "Nilgiris",
    category: "Grocery",
    emoji: "🛒",
    avgCost: 350,
    description:
      "Iconic South Indian grocery chain — fresh, organic and local.",
    tags: ["Organic", "Local", "Dairy"],
    lat: 13.0845,
    lng: 80.2723,
  },
  {
    id: 13,
    name: "DMart",
    category: "Grocery",
    emoji: "🛒",
    avgCost: 600,
    description:
      "Discount supermarket with unbeatable prices on bulk grocery items.",
    tags: ["Bulk", "Discount", "Value"],
    lat: 13.0623,
    lng: 80.2834,
  },
  {
    id: 14,
    name: "Kovai Pazhamudir Nilayam",
    category: "Grocery",
    emoji: "🛒",
    avgCost: 150,
    description: "Fresh fruits and vegetables directly from Coimbatore farms.",
    tags: ["Fresh", "Fruits", "Farm-to-Table"],
    lat: 13.0756,
    lng: 80.2589,
  },
  {
    id: 15,
    name: "Pondy Bazaar",
    category: "Shopping",
    emoji: "🛍️",
    avgCost: 500,
    description:
      "Chennai's busiest street shopping market for clothes and accessories.",
    tags: ["Street", "Clothing", "Bargain"],
    lat: 13.0934,
    lng: 80.2456,
  },
  {
    id: 16,
    name: "Express Avenue Mall",
    category: "Shopping",
    emoji: "🛍️",
    avgCost: 1200,
    description:
      "Premium lifestyle mall with 150+ brands, food court and multiplex.",
    tags: ["Mall", "Premium", "Brands"],
    lat: 13.0389,
    lng: 80.2234,
  },
  {
    id: 17,
    name: "Burma Bazaar",
    category: "Shopping",
    emoji: "🛍️",
    avgCost: 300,
    description: "Unique market for imported goods, cosmetics and electronics.",
    tags: ["Imports", "Electronics", "Cosmetics"],
    lat: 13.0467,
    lng: 80.2978,
  },
  {
    id: 18,
    name: "Croma",
    category: "Shopping",
    emoji: "🛍️",
    avgCost: 2500,
    description:
      "Leading electronics retail chain — gadgets, appliances and mobiles.",
    tags: ["Electronics", "Gadgets", "Appliances"],
    lat: 13.1123,
    lng: 80.2345,
  },
  {
    id: 19,
    name: "Apollo Pharmacy",
    category: "Healthcare",
    emoji: "🏥",
    avgCost: 200,
    description:
      "24/7 pharmacy with prescription medicines, health supplements.",
    tags: ["Pharmacy", "24/7", "Prescription"],
    lat: 13.0723,
    lng: 80.3012,
  },
  {
    id: 20,
    name: "MedPlus",
    category: "Healthcare",
    emoji: "🏥",
    avgCost: 180,
    description:
      "Affordable pharmacy chain with generic medicines and diagnostics.",
    tags: ["Generic", "Affordable", "Diagnostics"],
    lat: 13.0589,
    lng: 80.2145,
  },
  {
    id: 21,
    name: "Fortis Malar Hospital",
    category: "Healthcare",
    emoji: "🏥",
    avgCost: 800,
    description:
      "Multi-specialty hospital with OPD consultations and lab services.",
    tags: ["Hospital", "OPD", "Lab"],
    lat: 13.0845,
    lng: 80.2456,
  },
  {
    id: 22,
    name: "Lal Path Labs",
    category: "Healthcare",
    emoji: "🏥",
    avgCost: 350,
    description:
      "Diagnostic lab chain with home sample collection and online reports.",
    tags: ["Diagnostics", "Lab", "Home Collection"],
    lat: 13.0678,
    lng: 80.2923,
  },
  {
    id: 23,
    name: "Chennai Metro Rail",
    category: "Transport",
    emoji: "🚌",
    avgCost: 30,
    description: "Affordable metro rail — fastest way to beat Chennai traffic.",
    tags: ["Metro", "Affordable", "Fast"],
    lat: 13.0912,
    lng: 80.2812,
  },
  {
    id: 24,
    name: "Namma Chennai Bus",
    category: "Transport",
    emoji: "🚌",
    avgCost: 15,
    description:
      "MTC city bus network — budget transport across all of Chennai.",
    tags: ["Bus", "Budget", "City"],
    lat: 13.0534,
    lng: 80.2678,
  },
  {
    id: 25,
    name: "Ola/Uber Pickup",
    category: "Transport",
    emoji: "🚌",
    avgCost: 120,
    description: "Popular cab aggregator pickup points across the city.",
    tags: ["Cab", "Flexible", "Door-to-Door"],
    lat: 13.0723,
    lng: 80.2389,
  },
  {
    id: 26,
    name: "Rapido Bike",
    category: "Transport",
    emoji: "🚌",
    avgCost: 60,
    description:
      "Quick bike taxi for short distances — beat traffic economically.",
    tags: ["Bike Taxi", "Quick", "Economic"],
    lat: 13.0845,
    lng: 80.2567,
  },
  {
    id: 27,
    name: "PVR Cinemas VR Mall",
    category: "Entertainment",
    emoji: "🎭",
    avgCost: 350,
    description: "Multiplex with IMAX screen, Dolby sound and premium seating.",
    tags: ["Cinema", "IMAX", "Premium"],
    lat: 13.0612,
    lng: 80.2734,
  },
  {
    id: 28,
    name: "Elliot's Beach",
    category: "Entertainment",
    emoji: "🎭",
    avgCost: 50,
    description:
      "Pristine beach in Besant Nagar — free entry, evening strolls.",
    tags: ["Beach", "Free", "Outdoor"],
    lat: 13.0789,
    lng: 80.2845,
  },
  {
    id: 29,
    name: "Semmozhi Poonga",
    category: "Entertainment",
    emoji: "🎭",
    avgCost: 20,
    description:
      "Botanical garden with rare plants, walking paths and birdwatching.",
    tags: ["Garden", "Nature", "Family"],
    lat: 13.0534,
    lng: 80.2312,
  },
  {
    id: 30,
    name: "Escape Theme Park",
    category: "Entertainment",
    emoji: "🎭",
    avgCost: 900,
    description: "Largest amusement park in South India with 40+ rides.",
    tags: ["Amusement", "Rides", "Family"],
    lat: 13.0912,
    lng: 80.2634,
  },
  {
    id: 31,
    name: "Pondicherry Restaurants Row",
    category: "Food",
    emoji: "🍽️",
    avgCost: 450,
    description: "French-Tamil fusion eateries along the heritage promenade.",
    tags: ["Fusion", "Heritage", "Fine Dining"],
    lat: 13.0678,
    lng: 80.2812,
  },
  {
    id: 32,
    name: "Karpagam Coffee Works",
    category: "Coffee",
    emoji: "☕",
    avgCost: 45,
    description:
      "Old-school filter coffee roastery — aromatic beans ground fresh.",
    tags: ["Roastery", "Traditional", "Budget"],
    lat: 13.0823,
    lng: 80.2701,
  },
  {
    id: 33,
    name: "The Chennai Farmer's Market",
    category: "Grocery",
    emoji: "🛒",
    avgCost: 200,
    description:
      "Weekend organic market with direct farmer produce and millets.",
    tags: ["Organic", "Farmers", "Weekend"],
    lat: 13.0567,
    lng: 80.2567,
  },
];

// ─── Utility Functions ────────────────────────────────────────────────────────
function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function getBudgetStatus(cost: number, budget: number): BudgetStatus {
  if (cost <= budget * 0.8) return "under";
  if (cost <= budget) return "near";
  return "over";
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    );
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.suburb ||
      data.address?.state_district ||
      "Your Location"
    );
  } catch {
    return "Your Location";
  }
}

const STATUS_COLORS: Record<BudgetStatus, string> = {
  under: "#10B981",
  near: "#F59E0B",
  over: "#EF4444",
};

const STATUS_LABELS: Record<BudgetStatus, string> = {
  under: "Under budget",
  near: "Near limit",
  over: "Over budget",
};

// ─── Voice Search Hook ────────────────────────────────────────────────────────
function useVoiceSearch(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const start = () => {
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript: string = e.results[0][0].transcript;
      onResult(transcript);
      toast.success(`Voice: "${transcript}"`);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-4 animate-pulse"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-4 rounded"
            style={{ background: "var(--bg-muted)", width: "60%" }}
          />
          <div
            className="h-3 rounded"
            style={{ background: "var(--bg-muted)", width: "40%" }}
          />
        </div>
        <div
          className="h-5 w-20 rounded-full"
          style={{ background: "var(--bg-muted)" }}
        />
      </div>
      <div className="space-y-2 mb-4">
        <div
          className="h-3 rounded"
          style={{ background: "var(--bg-muted)", width: "100%" }}
        />
        <div
          className="h-3 rounded"
          style={{ background: "var(--bg-muted)", width: "80%" }}
        />
      </div>
      <div
        className="h-9 rounded-xl"
        style={{ background: "var(--bg-muted)" }}
      />
    </div>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────
interface PlaceCardProps {
  place: Place;
  index: number;
  onAddExpense: (name: string, category: string) => void;
}

function PlaceCard({ place, index, onAddExpense }: PlaceCardProps) {
  const status = place.budgetStatus || "over";
  const color = STATUS_COLORS[status];

  return (
    <div
      data-ocid={`place.item.${index + 1}`}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${color}`,
        animation: "fadeUp 0.4s ease both",
        animationDelay: `${index * 0.05}s`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${color}18` }}
            >
              {place.emoji}
            </div>
            <div>
              <div
                className="font-semibold text-sm leading-tight"
                style={{ color: "var(--text-heading)" }}
              >
                {place.name}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {place.distance} km away · {place.category}
              </div>
            </div>
          </div>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
            style={{
              background: `${color}18`,
              color,
            }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-xs mb-3 line-clamp-2"
          style={{ color: "var(--text-body)" }}
        >
          {place.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {place.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--bg-muted)",
                color: "var(--text-secondary)",
              }}
            >
              {tag}
            </span>
          ))}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: `${color}18`,
              color,
            }}
          >
            Est. ₹{place.avgCost}
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          data-ocid={`place.add_expense.${index + 1}`}
          className="w-full py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "var(--primary)",
            color: "var(--text-on-primary)",
          }}
          onClick={() => onAddExpense(place.name, place.category)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
        >
          ＋ Add Expense Here
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapsPage() {
  const navigate = useNavigate();

  // Location state
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [cityName, setCityName] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Filter state
  const [budget, setBudget] = useState(500);
  const [selectedPillIdx, setSelectedPillIdx] = useState(2);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");
  const [search, setSearch] = useState("");

  // Derived places state
  const [places, setPlaces] = useState<Place[]>([]);

  // Map refs
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const mapInitializedRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Voice search ──────────────────────────────────────────────────────────
  const {
    listening,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceSearch((transcript) => {
    setSearch(transcript);
  });

  // ── Inject pulse animation CSS ────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("maps-animations-style")) return;
    const style = document.createElement("style");
    style.id = "maps-animations-style";
    style.textContent = `
      @keyframes mapPulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(14,165,233,0.3); }
        50% { box-shadow: 0 0 0 10px rgba(14,165,233,0.08); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes waveBar {
        0%, 100% { transform: scaleY(0.4); }
        50%       { transform: scaleY(1); }
      }
      .leaflet-popup-content-wrapper {
        border-radius: 12px !important;
        padding: 0 !important;
      }
      .leaflet-popup-content {
        margin: 0 !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("maps-animations-style");
      if (el) el.remove();
    };
  }, []);

  // ── Auto-location on mount ─────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: initLocation is stable
  useEffect(() => {
    initLocation();
  }, []);

  function initLocation() {
    setLocationLoading(true);
    setLocationError(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          localStorage.setItem("userLat", String(lat));
          localStorage.setItem("userLng", String(lng));
          setUserLocation({ lat, lng });
          reverseGeocode(lat, lng).then(setCityName);
          setLocationLoading(false);
        },
        () => {
          const savedLat = localStorage.getItem("userLat");
          const savedLng = localStorage.getItem("userLng");
          if (savedLat && savedLng) {
            const lat = Number.parseFloat(savedLat);
            const lng = Number.parseFloat(savedLng);
            setUserLocation({ lat, lng });
            reverseGeocode(lat, lng).then(setCityName);
          } else {
            // Fallback coords — always reverse geocode, never hardcode city name
            const fallbackLat = 13.0827;
            const fallbackLng = 80.2707;
            setUserLocation({ lat: fallbackLat, lng: fallbackLng });
            reverseGeocode(fallbackLat, fallbackLng).then((city) => {
              setCityName(city || "Your Location");
            });
            setShowBanner(true);
          }
          setLocationError(true);
          setLocationLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: true },
      );
    } else {
      const fallbackLat = 13.0827;
      const fallbackLng = 80.2707;
      setUserLocation({ lat: fallbackLat, lng: fallbackLng });
      reverseGeocode(fallbackLat, fallbackLng).then((city) => {
        setCityName(city || "Your Location");
      });
      setLocationLoading(false);
    }
  }

  // ── Compute places with distance + budget status ──────────────────────────
  function computePlaces(
    lat: number,
    lng: number,
    activeBudget: number,
    category: FilterCategory,
    query: string,
  ): Place[] {
    let result = BASE_PLACES.map((p) => ({
      ...p,
      distance: getDistanceKm(lat, lng, p.lat, p.lng),
      budgetStatus: getBudgetStatus(p.avgCost, activeBudget),
    })) as Place[];

    if (category !== "All") {
      result = result.filter((p) => p.category === category);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.description.toLowerCase().includes(q),
      );
    }

    result.sort(
      (a, b) => Number.parseFloat(a.distance!) - Number.parseFloat(b.distance!),
    );
    return result;
  }

  // ── Update places whenever filters/location change ────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: computePlaces is stable inline fn
  useEffect(() => {
    if (!userLocation) return;
    const computed = computePlaces(
      userLocation.lat,
      userLocation.lng,
      budget,
      activeCategory,
      search,
    );
    setPlaces(computed);
  }, [userLocation, budget, activeCategory, search]);

  // ── Initialize Leaflet map ────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time init on userLocation
  useEffect(() => {
    if (!userLocation || mapInitializedRef.current) return;
    if (!mapContainerRef.current) return;

    mapInitializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: [userLocation.lat, userLocation.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Pulsing user location marker
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:14px;height:14px;
        background:#0EA5E9;
        border-radius:50%;
        border:2px solid white;
        box-shadow:0 0 0 4px rgba(14,165,233,0.3);
        animation:mapPulse 1.5s ease-in-out infinite;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup("<strong>You are here</strong>")
      .openPopup();

    const layer = L.layerGroup().addTo(map);
    markersLayerRef.current = layer;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      mapInitializedRef.current = false;
    };
  }, [userLocation]);

  // ── Update map markers when places change ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    for (const place of places) {
      const status = place.budgetStatus || "over";
      const color = STATUS_COLORS[status];
      const label = STATUS_LABELS[status];

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:12px;height:12px;
          background:${color};
          border-radius:50%;
          border:2px solid white;
          box-shadow:0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker([place.lat, place.lng], { icon })
        .addTo(markersLayerRef.current!)
        .bindPopup(`
          <div style="min-width:160px;padding:8px;font-family:sans-serif">
            <div style="font-weight:600;font-size:13px;margin-bottom:2px">${place.name}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${place.category}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}20;color:${color};font-size:10px;font-weight:500;margin-bottom:4px">
              ${label}
            </div>
            <div style="font-size:12px;color:#374151">Est. ₹${place.avgCost}</div>
          </div>
        `);
    }
  }, [places]);

  // ── Legend counts ─────────────────────────────────────────────────────────
  const underCount = places.filter((p) => p.budgetStatus === "under").length;
  const nearCount = places.filter((p) => p.budgetStatus === "near").length;
  const overCount = places.filter((p) => p.budgetStatus === "over").length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handlePillClick(idx: number) {
    setSelectedPillIdx(idx);
    setBudget(BUDGET_PILLS[idx].value);
  }

  function handleAddExpense(merchant: string, _category: string) {
    navigate({ to: "/add-expense" });
    toast.success(`Adding expense for ${merchant}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div
        className="min-h-screen pb-8"
        style={{ background: "var(--bg-page)" }}
      >
        {/* ── Sticky Header ── */}
        <div
          className="sticky top-0 z-40 px-4 py-3"
          style={{
            background: "var(--bg-navbar)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin
                className="w-5 h-5"
                style={{ color: "var(--text-on-primary)" }}
              />
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--text-on-primary)" }}
              >
                Nearby Places
              </h1>
            </div>

            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "var(--text-on-primary)",
              }}
            >
              <Navigation2 className="w-3.5 h-3.5" />
              <span id="city-display">{cityName || "Detecting..."}</span>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
          {/* ── Location Banner ── */}
          {showBanner && (
            <div
              data-ocid="maps.banner"
              className="flex items-start gap-3 p-3 rounded-xl text-sm"
              style={{
                background: "#fef3c7",
                border: "1px solid #fbbf24",
                color: "#92400e",
              }}
            >
              <span className="text-base">⚠️</span>
              <span className="flex-1">
                Using default location. Enable location for accurate results.
              </span>
              <button
                type="button"
                data-ocid="maps.banner.close_button"
                onClick={() => setShowBanner(false)}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Enable Location Button (shown only on error) ── */}
          {locationError && (
            <button
              type="button"
              data-ocid="maps.enable_location_button"
              onClick={initLocation}
              className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: "var(--primary)",
                color: "var(--text-on-primary)",
              }}
            >
              <Navigation2 className="w-4 h-4" />
              Enable Location Access
            </button>
          )}

          {/* ── Map Container ── */}
          <div
            ref={mapContainerRef}
            id="map-container"
            style={{
              height: "340px",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              zIndex: 1,
              background: "var(--bg-muted)",
            }}
          />

          {/* ── Legend ── */}
          <div
            id="budget-legend"
            className="flex items-center justify-center gap-4 flex-wrap text-sm"
            data-ocid="maps.legend"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#10B981" }}
              />
              <span style={{ color: "var(--text-body)" }}>
                Under budget ({underCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#F59E0B" }}
              />
              <span style={{ color: "var(--text-body)" }}>
                Near limit ({nearCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#EF4444" }}
              />
              <span style={{ color: "var(--text-body)" }}>
                Over budget ({overCount})
              </span>
            </div>
          </div>

          {/* ── Search Bar ── */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
            }}
          >
            <Search
              className="w-4 h-4 flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              data-ocid="maps.search_input"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-body)" }}
              placeholder="Search places, food, coffee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
            <button
              type="button"
              data-ocid="maps.mic_button"
              onClick={listening ? stopVoice : startVoice}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: listening ? "#EF4444" : "var(--primary)",
                color: "white",
              }}
              title={listening ? "Stop listening" : "Voice search"}
            >
              {listening ? (
                <div className="flex items-end gap-0.5 h-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 rounded-full"
                      style={{
                        background: "white",
                        height: `${8 + i * 3}px`,
                        animation: `waveBar 0.6s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* ── Budget Pills ── */}
          <div className="flex gap-2 flex-wrap">
            {BUDGET_PILLS.map((pill, idx) => (
              <button
                type="button"
                key={pill.label}
                data-ocid="maps.budget.tab"
                onClick={() => handlePillClick(idx)}
                className="budget-pill px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background:
                    selectedPillIdx === idx
                      ? "var(--primary)"
                      : "var(--bg-card)",
                  color:
                    selectedPillIdx === idx
                      ? "var(--text-on-primary)"
                      : "var(--text-body)",
                  border:
                    selectedPillIdx === idx
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                  transform:
                    selectedPillIdx === idx ? "scale(1.05)" : "scale(1)",
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* ── Category Pills ── */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                data-ocid="maps.category.tab"
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background:
                    activeCategory === cat
                      ? "var(--bg-secondary)"
                      : "var(--bg-card)",
                  color:
                    activeCategory === cat
                      ? "var(--primary)"
                      : "var(--text-muted)",
                  border:
                    activeCategory === cat
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                  fontWeight: activeCategory === cat ? 600 : 400,
                }}
              >
                {CATEGORY_EMOJIS[cat]} {cat}
              </button>
            ))}
          </div>

          {/* ── Results Count ── */}
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            {locationLoading ? (
              "Detecting your location..."
            ) : (
              <>
                <span style={{ color: "var(--text-heading)", fontWeight: 600 }}>
                  {places.length}
                </span>{" "}
                places found near {cityName || "you"}
              </>
            )}
          </div>

          {/* ── Place Cards Grid ── */}
          <div
            id="places-grid"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {locationLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : places.length === 0 ? (
              <div
                data-ocid="maps.empty_state"
                className="col-span-2 py-16 text-center"
              >
                <div className="text-4xl mb-3">🔍</div>
                <p
                  className="text-base font-medium"
                  style={{ color: "var(--text-heading)" }}
                >
                  No places found in this budget range
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Try adjusting your budget or category filter
                </p>
              </div>
            ) : (
              places.map((place, idx) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  index={idx}
                  onAddExpense={handleAddExpense}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
