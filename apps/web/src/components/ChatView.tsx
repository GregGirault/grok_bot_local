import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { displayName } from '@grok-bot/shared';
import type {
  ActivityMeta,
  Agent,
  AttachmentInfo,
  Channel,
  ChatMessage,
  ComputerState,
  EmailMeta,
  FileCardMeta,
  LinkMeta,
  Notice,
  Routine,
  SecretMeta,
  ToolCardMeta,
  WidgetMeta,
  ApprovalRequest,
} from '@grok-bot/shared';
import { api, streamChat, streamWidgetSelect, streamRegenerate } from '../lib/api';
import { t, type Lang, formatTime } from '../lib/i18n';
import BotAvatar from './BotAvatar';
import DetailsPane from './DetailsPane';
import ProfileEditor from './ProfileEditor';
import { ComputerIcon, BackIcon, MicIcon, CameraIcon, MoreIcon, ShareIcon } from './Icons';

type UiMsg = ChatMessage & { streaming?: boolean; open?: boolean };

export default function ChatView({
  agent,
  agents,
  lang,
  onAgentsChange,
  phone = false,
  onBack,
  onDelete,
}: {
  agent: Agent;
  agents: Agent[];
  lang: Lang;
  onAgentsChange: () => void;
  phone?: boolean;
  onBack?: () => void;
  onDelete?: (agent: Agent) => void;
}) {
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [paneOpen, setPaneOpen] = useState(!phone);
  const [profileOpen, setProfileOpen] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const [comp, setComp] = useState<ComputerState | null>(null);
  const [pending, setPending] = useState<AttachmentInfo[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [skills, setSkills] = useState<Array<{ name: string; description?: string }>>([]);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [hoverAction, setHoverAction] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [plugins, setPlugins] = useState<Array<{ slug: string; name: string; installed: boolean }>>([]);
  const [groups, setGroups] = useState<Channel[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [attachErr, setAttachErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  const first = displayName(agent.name);
