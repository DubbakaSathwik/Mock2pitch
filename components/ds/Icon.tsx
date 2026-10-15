import type { CSSProperties } from "react";
import {
  ArrowRight, Ban, ChartLine, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, CircleDot, CirclePlus, CircleX, Cpu,
  FileText, Gauge, Heart, History, House, Info, Layers, LayoutDashboard, ListChecks, Lock, LogOut, MessageCircle, MessageSquareText,
  MessageSquareWarning, Mic, MicOff, Moon, NotebookPen, Phone, Play, Plus, Presentation, RotateCcw, Search, ShieldCheck, Sparkles, Square,
  Star, Target, Timer, Trash2, TrendingUp, TriangleAlert, Upload, User, Users, Volume2, VolumeX, X,
} from "lucide-react";

// Explicit map (no whole-library import). Names are the Lucide 0.452 names used by the design handoff.
const ICONS = {
  "arrow-right": ArrowRight, ban: Ban, "chart-line": ChartLine, check: Check, "chevron-down": ChevronDown, "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight, "chevron-up": ChevronUp, "circle-check": CircleCheck, "circle-dot": CircleDot, "circle-plus": CirclePlus,
  "circle-x": CircleX, cpu: Cpu, "file-text": FileText, gauge: Gauge, heart: Heart, history: History, house: House, info: Info, layers: Layers,
  "layout-dashboard": LayoutDashboard, "list-checks": ListChecks, lock: Lock, "log-out": LogOut, "message-circle": MessageCircle,
  "message-square-text": MessageSquareText, "message-square-warning": MessageSquareWarning, mic: Mic, "mic-off": MicOff, moon: Moon,
  "notebook-pen": NotebookPen, phone: Phone, play: Play, plus: Plus, presentation: Presentation, "rotate-ccw": RotateCcw, search: Search,
  "shield-check": ShieldCheck, sparkles: Sparkles, square: Square, star: Star, target: Target, timer: Timer, "trash-2": Trash2,
  "trending-up": TrendingUp, "triangle-alert": TriangleAlert, upload: Upload, user: User, users: Users, "volume-2": Volume2, "volume-x": VolumeX, x: X,
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type IconProps = { name: IconName; size?: number; color?: string; className?: string; style?: CSSProperties };

/** Decorative by default (aria-hidden); put the accessible name on the control that contains it. */
export function Icon({ name, size = 20, color = "currentColor", className, style }: IconProps) {
  const Cmp = ICONS[name];
  return <Cmp aria-hidden="true" focusable="false" size={size} color={color} className={className} style={{ flexShrink: 0, display: "block", ...style }} />;
}
