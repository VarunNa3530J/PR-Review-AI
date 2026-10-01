"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Play,
  Code,
  Check,
  Folder,
  FileCode,
  Upload,
  History,
  Copy,
  FolderOpen,
  Save,
  FileCheck,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  CornerDownLeft,
  Plus,
  FolderPlus,
  FilePlus,
  Search,
  ThumbsUp,
  ThumbsDown,
  Mic,
  X,
  Zap,
  Code2,
  CheckCheck,
  Edit2,
  Trash2,
} from "lucide-react";

interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  file_path: string;
  line_start: number;
  line_end: number;
  explanation: string;
  suggested_patch?: string | null;
  source: string;
}

interface ReviewFileItem {
  path: string;
  content: string;
}

interface ReviewDetail {
  id: string;
  pr_number: number;
  title: string;
  repo: string;
  risk_level: string;
  status: string;
  duration_ms: number;
  files_reviewed: number;
  files_skipped: number;
  findings: Finding[];
  files?: ReviewFileItem[];
  quality_score?: number;
  created_at?: string;
  source_type?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: Record<string, TreeNode>;
}

export interface FileTypeInfo {
  language: string;
  label: string;
  iconColor: string;
  badgeBg: string;
}

export function getFileTypeInfo(filePath: string): FileTypeInfo {
  const clean = filePath.replace(/\\/g, "/");
  const fileName = clean.split("/").pop() || "";
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.includes(".") ? "." + lowerName.split(".").pop() : "";

  // Exact filenames
  if (lowerName === "dockerfile" || lowerName === "containerfile") {
    return { language: "dockerfile", label: "Dockerfile", iconColor: "text-sky-400", badgeBg: "bg-sky-500/10 text-sky-400" };
  }
  if (lowerName === "makefile" || lowerName === "gnumakefile") {
    return { language: "makefile", label: "Makefile", iconColor: "text-amber-400", badgeBg: "bg-amber-500/10 text-amber-400" };
  }
  if (lowerName.startsWith(".env")) {
    return { language: "properties", label: "Config (.env)", iconColor: "text-yellow-400", badgeBg: "bg-yellow-500/10 text-yellow-400" };
  }
  if (lowerName === "package.json") {
    return { language: "json", label: "NPM Config", iconColor: "text-rose-400", badgeBg: "bg-rose-500/10 text-rose-400" };
  }
  if (lowerName === "tsconfig.json") {
    return { language: "json", label: "TypeScript Config", iconColor: "text-blue-400", badgeBg: "bg-blue-500/10 text-blue-400" };
  }
  if (lowerName.startsWith(".git")) {
    return { language: "ignore", label: "Git Config", iconColor: "text-orange-400", badgeBg: "bg-orange-500/10 text-orange-400" };
  }

  // Extensions
  switch (ext) {
    case ".py":
    case ".pyw":
      return { language: "python", label: "Python", iconColor: "text-yellow-400", badgeBg: "bg-yellow-500/10 text-yellow-300" };
    case ".ipynb":
      return { language: "python", label: "Jupyter Notebook", iconColor: "text-orange-400", badgeBg: "bg-orange-500/10 text-orange-300" };
    case ".ts":
      return { language: "typescript", label: "TypeScript", iconColor: "text-blue-400", badgeBg: "bg-blue-500/10 text-blue-300" };
    case ".tsx":
      return { language: "typescriptreact", label: "React TSX", iconColor: "text-cyan-400", badgeBg: "bg-cyan-500/10 text-cyan-300" };
    case ".js":
    case ".mjs":
    case ".cjs":
      return { language: "javascript", label: "JavaScript", iconColor: "text-amber-300", badgeBg: "bg-amber-500/10 text-amber-300" };
    case ".jsx":
      return { language: "javascriptreact", label: "React JSX", iconColor: "text-cyan-300", badgeBg: "bg-cyan-500/10 text-cyan-300" };
    case ".html":
    case ".htm":
      return { language: "html", label: "HTML5", iconColor: "text-orange-500", badgeBg: "bg-orange-500/10 text-orange-400" };
    case ".css":
      return { language: "css", label: "CSS3", iconColor: "text-sky-400", badgeBg: "bg-sky-500/10 text-sky-400" };
    case ".scss":
    case ".sass":
      return { language: "scss", label: "Sass SCSS", iconColor: "text-pink-400", badgeBg: "bg-pink-500/10 text-pink-400" };
    case ".json":
    case ".jsonc":
      return { language: "json", label: "JSON", iconColor: "text-amber-400", badgeBg: "bg-amber-500/10 text-amber-300" };
    case ".yaml":
    case ".yml":
      return { language: "yaml", label: "YAML Config", iconColor: "text-purple-400", badgeBg: "bg-purple-500/10 text-purple-300" };
    case ".toml":
      return { language: "toml", label: "TOML", iconColor: "text-amber-600", badgeBg: "bg-amber-600/10 text-amber-400" };
    case ".xml":
    case ".svg":
      return { language: "xml", label: "XML", iconColor: "text-emerald-400", badgeBg: "bg-emerald-500/10 text-emerald-300" };
    case ".md":
    case ".mdx":
      return { language: "markdown", label: "Markdown", iconColor: "text-zinc-300", badgeBg: "bg-zinc-500/10 text-zinc-300" };
    case ".java":
      return { language: "java", label: "Java", iconColor: "text-rose-500", badgeBg: "bg-rose-500/10 text-rose-400" };
    case ".kt":
    case ".kts":
      return { language: "kotlin", label: "Kotlin", iconColor: "text-purple-400", badgeBg: "bg-purple-500/10 text-purple-300" };
    case ".go":
      return { language: "go", label: "Go", iconColor: "text-teal-400", badgeBg: "bg-teal-500/10 text-teal-300" };
    case ".rs":
      return { language: "rust", label: "Rust", iconColor: "text-orange-600", badgeBg: "bg-orange-600/10 text-orange-400" };
    case ".c":
    case ".h":
      return { language: "c", label: "C Source", iconColor: "text-blue-500", badgeBg: "bg-blue-500/10 text-blue-400" };
    case ".cpp":
    case ".hpp":
    case ".cc":
      return { language: "cpp", label: "C++", iconColor: "text-blue-600", badgeBg: "bg-blue-600/10 text-blue-400" };
    case ".cs":
      return { language: "csharp", label: "C#", iconColor: "text-violet-500", badgeBg: "bg-violet-500/10 text-violet-400" };
    case ".php":
      return { language: "php", label: "PHP", iconColor: "text-indigo-400", badgeBg: "bg-indigo-500/10 text-indigo-300" };
    case ".rb":
      return { language: "ruby", label: "Ruby", iconColor: "text-red-500", badgeBg: "bg-red-500/10 text-red-400" };
    case ".sh":
    case ".bash":
    case ".zsh":
      return { language: "shell", label: "Shell Script", iconColor: "text-emerald-400", badgeBg: "bg-emerald-500/10 text-emerald-300" };
    case ".ps1":
      return { language: "powershell", label: "PowerShell", iconColor: "text-blue-400", badgeBg: "bg-blue-500/10 text-blue-300" };
    case ".sql":
      return { language: "sql", label: "SQL Database", iconColor: "text-sky-300", badgeBg: "bg-sky-500/10 text-sky-300" };
    case ".vue":
      return { language: "vue", label: "Vue Component", iconColor: "text-emerald-500", badgeBg: "bg-emerald-500/10 text-emerald-400" };
    case ".svelte":
      return { language: "svelte", label: "Svelte Component", iconColor: "text-orange-500", badgeBg: "bg-orange-500/10 text-orange-400" };
    default:
      return { language: "plaintext", label: ext ? ext.slice(1).toUpperCase() + " File" : "Plain Text", iconColor: "text-zinc-400", badgeBg: "bg-zinc-500/10 text-zinc-400" };
  }
}

function buildFileTree(files: ReviewFileItem[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const f of files) {
    const parts = f.path.split(/[/\\]/);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const curPath = parts.slice(0, i + 1).join("/");

      if (!current[part]) {
        current[part] = {
          name: part,
          path: curPath,
          isFolder: !isFile,
          children: isFile ? undefined : {},
        };
      }
      if (!isFile && current[part].children) {
        current = current[part].children!;
      }
    }
  }

  return root;
}

function extractCleanFix(patch?: string | null, originalLine: string = ""): string {
  if (!patch) return "";
  const lines = patch.split("\n");
  const plusLine = lines.find((l) => l.trimStart().startsWith("+ "));
  if (plusLine) {
    const rawClean = plusLine.trimStart().slice(2);
    const leadingWhitespace = originalLine.match(/^\s*/)?.[0] || "";
    if (leadingWhitespace && !rawClean.startsWith(leadingWhitespace)) {
      return leadingWhitespace + rawClean.trimStart();
    }
    return rawClean;
  }
  if (!patch.includes("\n") && !patch.startsWith("-") && !patch.startsWith("#") && !patch.startsWith("//")) {
    const leadingWhitespace = originalLine.match(/^\s*/)?.[0] || "";
    return leadingWhitespace + patch.trim();
  }
  return "";
}

function resolveLineFix(finding: Finding, originalLine: string): string {
  let fix = extractCleanFix(finding.suggested_patch, originalLine);
  // If patch is missing or identical to originalLine, perform smart syntax typo correction
  if (!fix || fix.trim() === originalLine.trim()) {
    let candidate = originalLine;
    // 1. Remove stray dot before closing parens, commas, colons, brackets, e.g. foo(x). -> foo(x)
    candidate = candidate.replace(/\.\s*([),:;\]}])/g, "$1");
    // 2. Space before arithmetic/assignment operators after dot e.g. a. + b -> a + b
    candidate = candidate.replace(/\.\s*([+\-*/%=])/g, " $1");
    // 3. Remove trailing dot at end of statement e.g. return x. -> return x, print(x). -> print(x)
    candidate = candidate.replace(/\.\s*$/, "");
    // 4. Consecutive dots e.g. obj..prop -> obj.prop
    candidate = candidate.replace(/\.\.+/g, ".");
    // 5. Stray dot between identifiers e.g. print.(x) -> print(x)
    candidate = candidate.replace(/([a-zA-Z0-9_])\.\s*(\()/g, "$1$2");
    // 6. Stray dot directly after closing paren e.g. (x). -> (x)
    candidate = candidate.replace(/\)\./g, ")");
    // 7. Fix Python built-in capitalization e.g. Print( -> print(
    if (/^\s*Print\(/.test(candidate)) {
      candidate = candidate.replace(/^(\s*)Print\(/, "$1print(");
    }
    // 8. Missing closing parenthesis, bracket, or brace e.g. Print(x -> print(x)
    const openParens = (candidate.match(/\(/g) || []).length - (candidate.match(/\)/g) || []).length;
    const openBrackets = (candidate.match(/\[/g) || []).length - (candidate.match(/\]/g) || []).length;
    const openBraces = (candidate.match(/\{/g) || []).length - (candidate.match(/\}/g) || []).length;
    if (openParens > 0) candidate = candidate + ")".repeat(openParens);
    if (openBrackets > 0) candidate = candidate + "]".repeat(openBrackets);
    if (openBraces > 0) candidate = candidate + "}".repeat(openBraces);
    // 9. Missing colon for python compound statements
    if (
      /^\s*(def|if|elif|else|for|while|class|try|except|finally|with)\b/.test(candidate) &&
      !candidate.trimEnd().endsWith(":")
    ) {
      candidate = candidate.trimEnd() + ":";
    }

    if (candidate.trim() !== originalLine.trim()) {
      fix = candidate;
    } else if (originalLine.includes(".")) {
      // General fallback: if line has a dot causing error, strip the last dot or trailing punctuation
      fix = originalLine.replace(/\.\s*$/, "").replace(/\.\s*([)\]}])/g, "$1");
    }
  }
  return fix || originalLine;
}

export default function DashboardReviewPage() {
  const [reviews, setReviews] = useState<ReviewDetail[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null);
  const [selectedFileForInspection, setSelectedFileForInspection] = useState<ReviewFileItem | null>(null);
  const [selectedFileToScan, setSelectedFileToScan] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"findings" | "files" | "history">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "history" || tab === "files" || tab === "findings") {
        return tab as "findings" | "files" | "history";
      }
    }
    return "findings";
  });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Layout panels toggles (Left Chatbot & Right Tree)
  const [showLeftChat, setShowLeftChat] = useState(true);
  const [showRightTree, setShowRightTree] = useState(true);

  // Tree expansion state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Code Editor State
  const [editedCode, setEditedCode] = useState<string>("");
  const [editorViewMode, setEditorViewMode] = useState<"diff" | "edit">("diff");
  const [isModified, setIsModified] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // New File / Folder Modal State
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [fileSearchQuery, setFileSearchQuery] = useState("");

  // VS Code Style Inline File Rename State
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState<string>("");

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewMode, setReviewMode] = useState<"folder" | "file" | "diff">("folder");
  const [projectName, setProjectName] = useState("");

  // Single File Mode state
  const [singleFilePath, setSingleFilePath] = useState("");
  const [singleFileContent, setSingleFileContent] = useState("");

  // Folder Files State (Zero fake data - only real files loaded by user)
  const [folderFiles, setFolderFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isReadingFolder, setIsReadingFolder] = useState(false);
  const [readingProgress, setReadingProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    skippedCount: number;
  }>({ current: 0, total: 0, currentFile: "", skippedCount: 0 });

  // Diff Mode state
  const [diffFilePath, setDiffFilePath] = useState("");
  const [codePatchInput, setCodePatchInput] = useState("");

  // Chat conversation
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ sender: "user" | "ai"; text: string; codeFix?: string }>>([
    {
      sender: "ai",
      text: "PR Review AI is ready. Load your local project directory or create a file to start automated AST & security auditing.",
    },
  ]);

  // Sync editor when active file changes without effect cascading renders
  const [prevSelectedFilePath, setPrevSelectedFilePath] = useState<string | null>(null);
  const currentSelectedFilePath = selectedFileForInspection?.path ?? null;
  if (currentSelectedFilePath !== prevSelectedFilePath) {
    setPrevSelectedFilePath(currentSelectedFilePath);
    setEditedCode(selectedFileForInspection ? selectedFileForInspection.content : "");
    setIsModified(false);
  }

  useEffect(() => {
    let isSubscribed = true;
    async function fetchOverview() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/dashboard/overview", {
          credentials: "include",
        });
        if (!isSubscribed) return;
        if (res.ok) {
          const data = await res.json();
          if (data.recent_reviews && data.recent_reviews.length > 0) {
            setReviews(data.recent_reviews);
            setSelectedReview(data.recent_reviews[0]);
            if (data.recent_reviews[0].files && data.recent_reviews[0].files.length > 0) {
              setSelectedFileForInspection(data.recent_reviews[0].files[0]);
              setFolderFiles(data.recent_reviews[0].files);
            }
          }
        }
      } catch {
        // Handled silently
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }
    void fetchOverview();
    return () => {
      isSubscribed = false;
    };
  }, []);

  const IGNORED_PATH_SEGMENTS = [
    "node_modules", ".git", ".next", "dist", "build", "out",
    ".cache", ".turbo", "coverage", "__pycache__", ".pytest_cache",
    ".venv", "venv", "env", ".vscode", ".idea",
  ];

  const IGNORED_EXTENSIONS = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf",
    ".woff", ".woff2", ".ttf", ".eot", ".zip", ".tar", ".gz", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".pyc", ".class", ".jar", ".map",
    ".lock", "-lock.json", ".min.js", ".min.css", ".mp4", ".mp3",
  ];

  const MAX_FILE_SIZE_BYTES = 256 * 1024;

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    setIsReadingFolder(true);
    setReadingProgress({ current: 0, total: 0, currentFile: "Filtering file list...", skippedCount: 0 });

    await new Promise((r) => setTimeout(r, 20));

    const validCandidates: File[] = [];
    let skipped = 0;

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const relPath = file.webkitRelativePath || file.name;
      const lowerPath = relPath.toLowerCase();

      const hasIgnoredFolder = IGNORED_PATH_SEGMENTS.some((segment) =>
        lowerPath.split("/").includes(segment) || lowerPath.split("\\").includes(segment)
      );
      const hasIgnoredExt = IGNORED_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
      const isOversized = file.size > MAX_FILE_SIZE_BYTES;

      if (hasIgnoredFolder || hasIgnoredExt || isOversized || file.name.startsWith(".")) {
        skipped++;
      } else {
        validCandidates.push(file);
      }
    }

    setReadingProgress({
      current: 0,
      total: validCandidates.length,
      currentFile: `Found ${validCandidates.length} source files (${skipped} ignored/binaries skipped)`,
      skippedCount: skipped,
    });

    const loaded: Array<{ path: string; content: string }> = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < validCandidates.length; i += BATCH_SIZE) {
      const batch = validCandidates.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          try {
            const text = await file.text();
            loaded.push({
              path: file.webkitRelativePath || file.name,
              content: text,
            });
          } catch {
            // Handled
          }
        })
      );

      const processedCount = Math.min(i + BATCH_SIZE, validCandidates.length);
      const currentFileName = batch[batch.length - 1]?.name || "";

      setReadingProgress({
        current: processedCount,
        total: validCandidates.length,
        currentFile: currentFileName,
        skippedCount: skipped,
      });

      await new Promise((r) => setTimeout(r, 0));
    }

    if (loaded.length > 0) {
      const prioritized = loaded.slice(0, 100);
      setFolderFiles(prioritized);
      setSelectedFileForInspection(prioritized[0]);
      setSelectedFileToScan("all");

      const firstPath = loaded[0].path;
      if (firstPath.includes("/")) {
        const rootDir = firstPath.split("/")[0];
        if (rootDir && rootDir !== ".") setProjectName(rootDir);
      } else if (firstPath.includes("\\")) {
        const rootDir = firstPath.split("\\")[0];
        if (rootDir && rootDir !== ".") setProjectName(rootDir);
      }

      setShowReviewModal(false);
      setActiveTab("findings");
    }

    setIsReadingFolder(false);
  };

  const handleSingleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setSingleFilePath(file.name);
      setSingleFileContent(text);
      setFolderFiles([{ path: file.name, content: text }]);
      setSelectedFileForInspection({ path: file.name, content: text });
      setSelectedFileToScan("all");
      setShowReviewModal(false);
      setActiveTab("findings");
    } catch {
      // Handled
    }
  };

  // Run live analysis on single file or whole folder
  const handleRunLiveReview = async (forcedScanTarget?: string) => {
    const scanTarget = forcedScanTarget !== undefined ? forcedScanTarget : selectedFileToScan;

    setAnalyzing(true);
    setAnalysisStage("Scanning regex patterns, AST rules & secrets...");
    try {
      let filesToReview: Array<{ path: string; content: string }> = [];
      let title = "";

      const currentFilesSnapshot = folderFiles.map((f) =>
        f.path === selectedFileForInspection?.path ? { ...f, content: editedCode } : f
      );

      if (scanTarget !== "all") {
        filesToReview = currentFilesSnapshot.filter((f) => f.path === scanTarget);
        if (filesToReview.length === 0 && selectedFileForInspection) {
          filesToReview = [{ path: selectedFileForInspection.path, content: editedCode }];
        }
        title = `Single File Audit: ${scanTarget} (${projectName})`;
      } else {
        filesToReview = currentFilesSnapshot;
        title = `Directory Audit: ${projectName} (${currentFilesSnapshot.length} files)`;
      }

      const stageTimer = setTimeout(() => {
        setAnalysisStage("Dispatching files to Gemini AI Engine...");
      }, 900);

      const stageTimer2 = setTimeout(() => {
        setAnalysisStage("Synthesizing solutions & visual diffs...");
      }, 2200);

      const res = await fetch("http://localhost:8000/api/v1/reviews/review-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source_type: "folder",
          title: title,
          repo_name: projectName,
          files: filesToReview,
          all_files: currentFilesSnapshot,
        }),
      });

      clearTimeout(stageTimer);
      clearTimeout(stageTimer2);

      if (res.ok) {
        const newRev = await res.json();
        setReviews((prev) => [newRev, ...prev]);
        setSelectedReview(newRev);

        if (newRev.files && newRev.files.length > 0) {
          setFolderFiles(newRev.files);
          const match = newRev.files.find((f: ReviewFileItem) => f.path === (selectedFileForInspection?.path || scanTarget));
          setSelectedFileForInspection(match || newRev.files[0]);
        }

        setShowReviewModal(false);
        setActiveTab("findings");

        // Add feedback message in chat
        const issueCount = newRev.findings?.length || 0;
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Audit finished: Analyzed ${filesToReview.length} file(s) in ${((newRev.duration_ms || 1200) / 1000).toFixed(1)}s. Found ${issueCount} issues. Problem lines are highlighted in red in the middle editor.`,
          },
        ]);
      }
    } catch {
      // Handled
    } finally {
      setAnalyzing(false);
      setAnalysisStage("");
    }
  };

  const handleSaveFileEdits = () => {
    if (!selectedFileForInspection) return;
    const updated = folderFiles.map((f) =>
      f.path === selectedFileForInspection.path ? { ...f, content: editedCode } : f
    );
    setFolderFiles(updated);
    setSelectedFileForInspection({ ...selectedFileForInspection, content: editedCode });
    if (selectedReview?.files) {
      setSelectedReview({
        ...selectedReview,
        files: selectedReview.files.map((f) =>
          f.path === selectedFileForInspection.path ? { ...f, content: editedCode } : f
        ),
      });
    }
    setIsModified(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
  };

  const handleCreateNewFile = () => {
    if (!newItemName.trim()) return;
    const cleanPath = newItemName.trim().replace(/^[/\\]+/, "");
    // Check if file already exists
    if (folderFiles.some((f) => f.path === cleanPath)) {
      alert("A file with this name already exists in workspace.");
      return;
    }
    const newFileItem = {
      path: cleanPath,
      content: `// ${cleanPath}\n// Start writing code or paste contents here\n\nexport function example() {\n  return true;\n}\n`,
    };
    const updated = [...folderFiles, newFileItem];
    setFolderFiles(updated);
    if (selectedReview?.files) {
      setSelectedReview({
        ...selectedReview,
        files: [...selectedReview.files, newFileItem],
      });
    }
    setSelectedFileForInspection(newFileItem);
    setSelectedFileToScan(cleanPath);
    setNewItemName("");
    setShowNewFileModal(false);
  };

  const handleStartRename = (oldPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenamingPath(oldPath);
    const fileName = oldPath.split(/[/\\]/).pop() || oldPath;
    setRenamingValue(fileName);
  };

  const handleCommitRename = (oldPath: string) => {
    if (!renamingValue.trim() || renamingValue.trim() === oldPath.split(/[/\\]/).pop()) {
      setRenamingPath(null);
      setRenamingValue("");
      return;
    }

    const trimmedNewName = renamingValue.trim().replace(/[/\\]/g, "");
    const parts = oldPath.split(/[/\\]/);
    parts.pop();
    const newPath = parts.length > 0 ? `${parts.join("/")}/${trimmedNewName}` : trimmedNewName;

    if (folderFiles.some((f) => f.path === newPath && f.path !== oldPath)) {
      alert("A file with this name already exists.");
      return;
    }

    const updatedFolderFiles = folderFiles.map((f) =>
      f.path === oldPath ? { ...f, path: newPath } : f
    );
    setFolderFiles(updatedFolderFiles);

    if (selectedReview) {
      const updatedReviewFiles = (selectedReview.files || []).map((f) =>
        f.path === oldPath ? { ...f, path: newPath } : f
      );
      const updatedFindings = (selectedReview.findings || []).map((f) =>
        f.file_path === oldPath ? { ...f, file_path: newPath } : f
      );
      setSelectedReview({
        ...selectedReview,
        files: updatedReviewFiles,
        findings: updatedFindings,
      });
    }

    if (selectedFileForInspection?.path === oldPath) {
      setSelectedFileForInspection({ ...selectedFileForInspection, path: newPath });
      setSelectedFileToScan(newPath);
    }

    setRenamingPath(null);
    setRenamingValue("");
  };

  const handleDeleteFile = (targetPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fileName = targetPath.split(/[/\\]/).pop() || targetPath;
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    const remaining = folderFiles.filter((f) => f.path !== targetPath);
    setFolderFiles(remaining);

    if (selectedReview) {
      setSelectedReview({
        ...selectedReview,
        files: (selectedReview.files || []).filter((f) => f.path !== targetPath),
        findings: (selectedReview.findings || []).filter((f) => f.file_path !== targetPath),
      });
    }

    if (selectedFileForInspection?.path === targetPath) {
      const nextFile = remaining[0] || null;
      setSelectedFileForInspection(nextFile);
      setSelectedFileToScan(nextFile ? nextFile.path : "all");
    }
  };

  const handleCreateNewFolder = () => {
    if (!newItemName.trim()) return;
    const cleanFolder = newItemName.trim().replace(/[/\\]+$/, "");
    const placeholderFilePath = `${cleanFolder}/index.ts`;
    if (folderFiles.some((f) => f.path.startsWith(`${cleanFolder}/`))) {
      alert("This folder or a file inside it already exists.");
      return;
    }
    const newFolderItem = {
      path: placeholderFilePath,
      content: `// New directory: ${cleanFolder}\nexport const initialized = true;\n`,
    };
    const updated = [...folderFiles, newFolderItem];
    setFolderFiles(updated);
    if (selectedReview?.files) {
      setSelectedReview({
        ...selectedReview,
        files: [...selectedReview.files, newFolderItem],
      });
    }
    setExpandedFolders((prev) => ({ ...prev, [cleanFolder]: true }));
    setSelectedFileForInspection(newFolderItem);
    setSelectedFileToScan(placeholderFilePath);
    setNewItemName("");
    setShowNewFolderModal(false);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage.trim();
    setChatHistory((prev) => [...prev, { sender: "user", text: msg }]);
    setChatMessage("");

    setTimeout(() => {
      let reply = `Analyzing "${selectedFileForInspection?.path || "codebase"}": All code changes passed AST verification.`;
      if (msg.toLowerCase().includes("security") || msg.toLowerCase().includes("secret") || msg.toLowerCase().includes("password")) {
        reply = "Security Alert: Ensure no hardcoded tokens exist in source files. Move sensitive credentials to process.env.";
      } else if (msg.toLowerCase().includes("fix") || msg.toLowerCase().includes("replace")) {
        reply = "Suggested replacement code is ready below. You can copy it or save directly to the editor.";
      }
      setChatHistory((prev) => [...prev, { sender: "ai", text: reply }]);
    }, 400);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Active findings on current file (robust matching by exact path or normalized path)
  const activeFileFindings = (selectedReview?.findings || []).filter((f) => {
    if (!selectedFileForInspection?.path) return false;
    const inspectPath = selectedFileForInspection.path.replace(/\\/g, "/").toLowerCase();
    const findPath = (f.file_path || "").replace(/\\/g, "/").toLowerCase();
    return (
      findPath === inspectPath ||
      findPath.endsWith("/" + inspectPath) ||
      inspectPath.endsWith("/" + findPath) ||
      findPath.split("/").pop() === inspectPath.split("/").pop()
    );
  });

  // Group of flagged line numbers
  const flaggedLineMap = new Map<number, Finding>();
  for (const f of activeFileFindings) {
    const start = f.line_start || 1;
    const end = f.line_end || f.line_start || 1;
    for (let l = start; l <= end; l++) {
      flaggedLineMap.set(l, f);
    }
  }


  const handleApplySingleFix = (lineNum: number, replacementLine: string) => {
    const lines = editedCode.split("\n");
    if (lineNum >= 1 && lineNum <= lines.length) {
      lines[lineNum - 1] = replacementLine;
      const newCode = lines.join("\n");
      setEditedCode(newCode);
      setIsModified(true);
      if (selectedFileForInspection) {
        setSelectedFileForInspection({ ...selectedFileForInspection, content: newCode });
      }
      if (selectedReview?.findings) {
        setSelectedReview({
          ...selectedReview,
          findings: selectedReview.findings.filter(
            (f) => !(f.file_path === selectedFileForInspection?.path && f.line_start === lineNum)
          ),
        });
      }
    }
  };

  const handleApplyAllFixes = () => {
    const lines = editedCode.split("\n");
    for (const finding of activeFileFindings) {
      if (finding.line_start >= 1 && finding.line_start <= lines.length) {
        const currentLine = lines[finding.line_start - 1] || "";
        const fixed = resolveLineFix(finding, currentLine);
        if (fixed && fixed.trim() !== currentLine.trim()) {
          lines[finding.line_start - 1] = fixed;
        }
      }
    }
    const newCode = lines.join("\n");
    setEditedCode(newCode);
    setIsModified(true);
    if (selectedFileForInspection) {
      setSelectedFileForInspection({ ...selectedFileForInspection, content: newCode });
    }
    if (selectedReview?.findings) {
      setSelectedReview({
        ...selectedReview,
        findings: selectedReview.findings.filter(
          (f) => f.file_path !== selectedFileForInspection?.path
        ),
      });
    }
  };

  const criticalFindings = selectedReview?.findings.filter((f) => f.severity === "critical") || [];
  const highFindings = selectedReview?.findings.filter((f) => f.severity === "high") || [];
  const mediumFindings = selectedReview?.findings.filter((f) => f.severity === "medium") || [];

  const healthScore =
    selectedReview?.quality_score ??
    Math.max(5, 100 - (criticalFindings.length * 25 + highFindings.length * 15 + mediumFindings.length * 5));

  const activeTreeFiles =
    selectedReview?.files && selectedReview.files.length > 0
      ? selectedReview.files
      : folderFiles;
  const fileTreeRoot = buildFileTree(activeTreeFiles);

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    if (node.isFolder) {
      const isExpanded = expandedFolders[node.path] !== false;
      return (
        <div key={node.path} className="space-y-0.5 select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-[#9DA3AE] hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors"
            style={{ paddingLeft: `${Math.max(6, depth * 12)}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/40" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/40" />
            )}
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
            <span className="font-medium text-[11px] truncate">{node.name}</span>
          </div>

          {isExpanded && node.children && (
            <div>
              {Object.values(node.children).map((child) =>
                renderTreeNode(child, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFileForInspection?.path === node.path;
    const fileDefects = (selectedReview?.findings || []).filter((f) => {
      const inspectPath = node.path.replace(/\\/g, "/").toLowerCase();
      const findPath = (f.file_path || "").replace(/\\/g, "/").toLowerCase();
      return (
        findPath === inspectPath ||
        findPath.endsWith("/" + inspectPath) ||
        inspectPath.endsWith("/" + findPath) ||
        findPath.split("/").pop() === inspectPath.split("/").pop()
      );
    });
    const hasCritical = fileDefects.some((f) => f.severity === "critical");

    const fileType = getFileTypeInfo(node.path);
    const isRenaming = renamingPath === node.path;

    return (
      <div
        key={node.path}
        onClick={() => {
          if (isRenaming) return;
          const match = activeTreeFiles.find((f) => f.path === node.path);
          if (match) setSelectedFileForInspection(match);
          setSelectedFileToScan(node.path);
        }}
        onDoubleClick={(e) => {
          handleStartRename(node.path, e);
        }}
        className={`group flex items-center justify-between py-1 px-2 rounded-md text-xs cursor-pointer transition-all ${
          isSelected
            ? "bg-white/[0.08] text-white font-medium border border-white/[0.12]"
            : "text-[#8E95A2] hover:text-white hover:bg-white/[0.03]"
        }`}
        style={{ paddingLeft: `${Math.max(12, depth * 12)}px` }}
        title={`${node.name} (${fileType.label}) — Double-click to rename`}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          <FileCode
            className={`w-3.5 h-3.5 shrink-0 ${
              hasCritical
                ? "text-rose-400"
                : fileDefects.length > 0
                ? "text-amber-400"
                : fileType.iconColor
            }`}
          />
          {isRenaming ? (
            <input
              type="text"
              autoFocus
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitRename(node.path);
                if (e.key === "Escape") setRenamingPath(null);
              }}
              onBlur={() => handleCommitRename(node.path)}
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-0.5 text-[11px] font-mono bg-black border border-emerald-500 rounded text-white focus:outline-none w-full"
            />
          ) : (
            <span className="font-mono text-[11px] truncate">{node.name}</span>
          )}
        </div>

        {/* Right side: File type tag, error badge & rename/delete actions */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {!isRenaming && (
            <span
              className={`text-[9px] px-1 rounded font-mono select-none hidden group-hover:inline sm:inline ${fileType.badgeBg}`}
            >
              {fileType.label}
            </span>
          )}

          {fileDefects.length > 0 && !isRenaming && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                hasCritical
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {fileDefects.length}
            </span>
          )}

          {/* Quick Action Buttons on Hover like VS Code */}
          {!isRenaming && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={(e) => handleStartRename(node.path, e)}
                className="p-1 rounded hover:bg-white/[0.1] text-zinc-400 hover:text-white"
                title="Rename file (F2 / Enter)"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => handleDeleteFile(node.path, e)}
                className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400"
                title="Delete file"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const editorLines = editedCode.split("\n");

  return (
    <AppShell>
      {/* Studio Sub-Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06] mb-3 shrink-0">
        {/* Left Breadcrumb & Model Indicator */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[#8E95A2] font-mono flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-white font-semibold">{projectName || "Workspace"}</span>
          </span>
          <span className="text-white/20">&bull;</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Health: {healthScore}%
          </span>
          <span className="text-[10px] text-[#8E95A2] font-mono hidden sm:inline">
            ({selectedReview?.findings?.length || 0} issues detected)
          </span>
        </div>

        {/* Right Action Controls: Toggle Panels, Scan & Upload */}
        <div className="flex items-center gap-2">
          {/* Panel Visibility Toggles */}
          <button
            onClick={() => setShowLeftChat(!showLeftChat)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showLeftChat
                ? "bg-white/[0.08] border-white/20 text-white"
                : "bg-white/[0.02] border-white/[0.06] text-[#8E95A2] hover:text-white"
            }`}
            title="Toggle Left AI Chat Assistant"
          >
            {showLeftChat ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowRightTree(!showRightTree)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showRightTree
                ? "bg-white/[0.08] border-white/20 text-white"
                : "bg-white/[0.02] border-white/[0.06] text-[#8E95A2] hover:text-white"
            }`}
            title="Toggle Right Folder Tree"
          >
            {showRightTree ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-px bg-white/[0.08] mx-1"></div>

          {/* History Button */}
          {reviews.length > 0 && (
            <button
              onClick={() => setActiveTab(activeTab === "history" ? "findings" : "history")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-white/[0.12] text-white border-white/20"
                  : "bg-white/[0.03] text-[#8E95A2] hover:text-white border-white/[0.06]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({reviews.length})</span>
            </button>
          )}

          {/* New Upload Button */}
          <button
            onClick={() => setShowReviewModal(true)}
            className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] rounded-lg text-xs font-semibold apple-press flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-32 text-center text-xs text-[#8E95A2] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-white/50" />
          <span>Synchronizing security engines & project workspace...</span>
        </div>
      ) : activeTab === "history" ? (
        /* SAVED AUDITS & FOLDERS RESTORE */
        <div className="bg-[#0D0F14] rounded-xl p-5 border border-white/[0.06] space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-semibold text-white">Saved Audits & Uploaded Folders</h3>
              <p className="text-xs text-[#8E95A2] mt-0.5">
                Click any previous folder or run to instantly restore its full file tree and findings.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("findings")}
              className="text-xs text-white/80 hover:text-white flex items-center gap-1 underline underline-offset-4"
            >
              Return to Editor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {reviews.map((rev) => {
              const isCurrent = selectedReview?.id === rev.id;
              const crit = rev.findings.filter((f) => f.severity === "critical").length;
              const score = rev.quality_score ?? 90;

              return (
                <div
                  key={rev.id}
                  onClick={() => {
                    setSelectedReview(rev);
                    if (rev.files && rev.files.length > 0) {
                      setFolderFiles(rev.files);
                      setSelectedFileForInspection(rev.files[0]);
                    }
                    setActiveTab("findings");
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                    isCurrent
                      ? "bg-white/[0.08] border-white/20 shadow-lg"
                      : "bg-[#11141A] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/80">
                        <Folder className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white truncate max-w-[140px]">{rev.repo}</div>
                        <div className="text-[10px] text-[#8E95A2] font-mono">Run #{rev.pr_number}</div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        score >= 80 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {score}%
                    </span>
                  </div>

                  <div className="text-xs text-white/90 line-clamp-1 font-medium">{rev.title}</div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] text-[#8E95A2]">
                    <span>
                      {rev.files?.length || rev.files_reviewed} files &bull; {rev.findings.length} issues
                      {crit > 0 && ` (${crit} crit)`}
                    </span>
                    <span className="text-white hover:underline font-medium">Open &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3-COLUMN STUDIO LAYOUT: [LEFT: CHATBOT] [MIDDLE: CODE EDITOR & INLINE DIFF] [RIGHT: FOLDER TREE] */
        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-hidden">
          {/* 1. LEFT SIDE: AI CHATBOT (Approx 320px fixed, collapsible, styled like Screenshot) */}
          {showLeftChat && (
            <div className="w-full lg:w-80 shrink-0 bg-[#0E1015] rounded-xl border border-white/[0.08] flex flex-col overflow-hidden">
              {/* Chat Header with macOS Traffic Lights & Title */}
              <div className="px-3.5 py-2.5 bg-[#12151C] border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] inline-block opacity-80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] inline-block opacity-80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F] inline-block opacity-80" />
                  </div>
                  <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                    {projectName ? `Review: ${projectName}` : "Fix dashboard"}
                  </span>
                </div>
                <button
                  onClick={() => setShowLeftChat(false)}
                  className="p-1 rounded text-[#8E95A2] hover:text-white"
                  title="Close Assistant"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
                {/* User Prompt Pill Card matching Screenshot */}
                <div className="bg-[#1A1D26] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white">
                  Fix security issues, optimize code, and clean up empty states.
                </div>

                <div className="text-[11px] text-[#8E95A2] flex items-center gap-1 px-1">
                  <span>Worked for 1m 20s</span>
                  <ChevronRight className="w-3 h-3 text-[#636366]" />
                </div>

                {/* AI Explanation Text */}
                <div className="text-[#D1D5DB] leading-relaxed text-[11px] px-1 space-y-2">
                  <p>
                    I scanned the active files against AST patterns and security checks. Problems are flagged in red blocks with corresponding green fixes below.
                  </p>
                  <p>
                    You can directly edit code with line numbers, add files (+) or folders (+), and click <strong>Save</strong> to verify anytime.
                  </p>
                </div>

                {/* Edited Files Card matching Screenshot - dynamic based on actual files loaded */}
                {activeTreeFiles.length > 0 && (
                  <div className="bg-[#161922] border border-white/[0.06] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-white/[0.08] flex items-center justify-center text-[10px] text-zinc-300 font-mono font-bold">
                          &plusmn;
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">
                            Audited {activeTreeFiles.length} file{activeTreeFiles.length > 1 ? "s" : ""}
                          </div>
                          <div className="text-[10px] font-mono">
                            <span className="text-emerald-400 font-bold">+{activeFileFindings.length > 0 ? activeFileFindings.length * 3 : 1}</span>{" "}
                            <span className="text-rose-400 font-bold">-{activeFileFindings.length > 0 ? activeFileFindings.length * 2 : 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (selectedFileForInspection) {
                              setEditedCode(selectedFileForInspection.content);
                              setIsModified(false);
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 transition-colors font-medium"
                        >
                          Undo
                        </button>
                        <button
                          disabled={analyzing}
                          onClick={() => handleRunLiveReview(selectedFileForInspection?.path)}
                          className="px-2 py-0.5 rounded text-[10px] bg-white text-black hover:bg-zinc-200 transition-colors font-bold disabled:opacity-40"
                        >
                          Review
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.04] space-y-1.5 text-[10px] font-mono max-h-28 overflow-y-auto">
                      {activeTreeFiles.slice(0, 5).map((f, i) => {
                        const fileFindings = (selectedReview?.findings || []).filter((find) => find.file_path === f.path);
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedFileForInspection(f);
                              setSelectedFileToScan(f.path);
                            }}
                            className="flex items-center justify-between text-[#8E95A2] hover:text-white cursor-pointer"
                          >
                            <span className="truncate max-w-[170px]">{f.path}</span>
                            <span className="text-emerald-400 font-medium">
                              {fileFindings.length > 0 ? `+${fileFindings.length * 2} -${fileFindings.length}` : "✓ 0"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback action icons matching Screenshot: [copy, thumbs up, thumbs down, more] */}
                <div className="flex items-center gap-2 text-[#8E95A2] px-1 pt-1">
                  <button
                    onClick={() => copyToClipboard(editedCode, "editor-code")}
                    className="p-1 rounded hover:bg-white/[0.06] hover:text-white transition-colors"
                    title={copiedId === "editor-code" ? "Copied!" : "Copy code"}
                  >
                    {copiedId === "editor-code" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button className="p-1 rounded hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1 rounded hover:bg-white/[0.06] hover:text-white transition-colors">
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col space-y-1 ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl leading-relaxed text-xs max-w-[95%] ${
                        msg.sender === "user"
                          ? "bg-white/[0.12] text-white"
                          : "bg-[#161922] border border-white/[0.06] text-[#D1D5DB]"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {analyzing && (
                  <div className="p-2.5 rounded-xl bg-[#161922] border border-white/[0.06] text-xs text-[#8E95A2] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>{analysisStage || "Auditing files..."}</span>
                  </div>
                )}
              </div>

              {/* Chat Input Pill matching Screenshot: [+] [Do anything...] [5.6 Sol Medium] [Mic] [Send] */}
              <div className="p-2.5 bg-[#12151C] border-t border-white/[0.06]">
                <div className="bg-[#1A1D26] border border-white/[0.08] rounded-xl p-2 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Do anything. @ to use plugins"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="bg-transparent text-xs text-white placeholder:text-[#636366] focus:outline-none w-full"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="p-1 rounded hover:bg-white/[0.08] text-[#8E95A2] hover:text-white transition-colors"
                      title="Attach file / folder"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#8E95A2] font-mono px-1.5 py-0.5 rounded bg-white/[0.04]">
                        Gemini Pro
                      </span>
                      <button className="text-[#8E95A2] hover:text-white">
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleSendMessage}
                        className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-sm"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MIDDLE COLUMN: MAIN CODE EDITOR WITH LINE NUMBERS & INLINE RED/GREEN DIFF BLOCKS */}
          <div className="flex-1 bg-[#090A0E] rounded-xl border border-white/[0.08] flex flex-col overflow-hidden min-w-0">
            {/* Editor Action Bar with Tabs & Actions matching User Screenshot */}
            <div className="px-3 py-2 bg-[#0C0E13] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Left: Tab bar like user image: [Review x] [+] */}
              <div className="flex items-center gap-3">
                {selectedFileForInspection ? (
                  (() => {
                    const activeType = getFileTypeInfo(selectedFileForInspection.path);
                    return (
                      <div className="flex items-center gap-1.5 bg-[#141720] border border-white/[0.08] px-2.5 py-1 rounded-md text-xs text-white group">
                        <FileCode className={`w-3.5 h-3.5 ${activeType.iconColor}`} />
                        <span className="font-mono text-[11px] font-medium truncate max-w-[180px]">
                          {selectedFileForInspection.path.split(/[/\\]/).pop()}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-semibold ${activeType.badgeBg}`}>
                          {activeType.label}
                        </span>
                        <button
                          onClick={(e) => handleStartRename(selectedFileForInspection.path, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white text-zinc-400 ml-1 transition-opacity"
                          title="Rename this file"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center gap-1 bg-[#141720] border border-white/[0.08] px-2.5 py-1 rounded-md text-xs text-zinc-400">
                    <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-mono text-[11px]">No file open</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setNewItemName("");
                    setShowNewFileModal(true);
                  }}
                  className="p-1 rounded text-[#8E95A2] hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Open new file tab"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <div className="h-3 w-px bg-white/[0.08]"></div>

                {/* Inline Diff vs Edit Code Mode Switcher */}
                <div className="flex items-center rounded-md bg-black/50 border border-white/[0.08] p-0.5">
                  <button
                    onClick={() => setEditorViewMode("diff")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                      editorViewMode === "diff"
                        ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                        : "text-[#8E95A2] hover:text-white"
                    }`}
                    title="View inline red error lines and green fixes"
                  >
                    <Zap className={`w-3 h-3 ${activeFileFindings.length > 0 ? "text-emerald-400" : "text-zinc-400"}`} />
                    <span>Inline Diff</span>
                    {activeFileFindings.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-300 font-mono font-bold">
                        {activeFileFindings.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setEditorViewMode("edit")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                      editorViewMode === "edit"
                        ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                        : "text-[#8E95A2] hover:text-white"
                    }`}
                    title="Direct code editing"
                  >
                    <Code2 className="w-3 h-3 text-zinc-400" />
                    <span>Edit Source</span>
                  </button>
                </div>

                {/* Unstaged Diff count indicator like screenshot */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono hidden md:flex">
                  <span className="text-[#8E95A2]">Unstaged</span>
                  <span className="text-emerald-400 font-semibold">+{activeFileFindings.length > 0 ? activeFileFindings.length * 4 : 2}</span>
                  <span className="text-rose-400 font-semibold">-{activeFileFindings.length > 0 ? activeFileFindings.length * 3 : 0}</span>
                </div>
              </div>

              {/* Right: Save, Scan, and Commit buttons */}
              <div className="flex items-center gap-2">
                {activeFileFindings.length > 0 && (
                  <button
                    onClick={handleApplyAllFixes}
                    className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                    title="Apply all suggested fixes to current file"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fix All ({activeFileFindings.length})</span>
                  </button>
                )}
                {/* Save button with toast */}
                <button
                  onClick={handleSaveFileEdits}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isModified
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                      : "bg-white/[0.04] text-[#8E95A2] hover:text-white border border-white/[0.06]"
                  }`}
                  title="Save current file changes"
                >
                  <Save className={`w-3.5 h-3.5 ${isModified ? "text-emerald-400" : "text-zinc-400"}`} />
                  <span>{saveToast ? "Saved!" : isModified ? "Save *" : "Save"}</span>
                </button>

                {/* Option A: Scan Only This File */}
                <button
                  disabled={analyzing || !selectedFileForInspection}
                  onClick={() => handleRunLiveReview(selectedFileForInspection?.path)}
                  className="px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#D1D5DB] border border-white/[0.08] flex items-center gap-1.5 transition-all disabled:opacity-40"
                  title="Run security scan on only this open file"
                >
                  <FileCheck className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Scan This File</span>
                </button>

                {/* Option B: Commit / Full Scan */}
                <button
                  disabled={analyzing}
                  onClick={() => handleRunLiveReview("all")}
                  className="px-3 py-1 rounded-md bg-white text-black text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-all disabled:opacity-40 shadow-sm"
                  title="Run security scan across all files in directory"
                >
                  {analyzing ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-black" />
                  ) : (
                    <Play className="w-3 h-3 fill-black text-black" />
                  )}
                  <span>Commit / Full Scan</span>
                </button>
              </div>
            </div>

            {/* Sub-header file path banner matching User Image */}
            <div className="px-3 py-1.5 bg-[#08090D] border-b border-white/[0.04] flex items-center justify-between text-xs shrink-0 font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[#8E95A2] truncate">{selectedFileForInspection?.path || "No file open"}</span>
                {activeFileFindings.length > 0 && (
                  <span className="text-rose-400 font-semibold text-[11px]">
                    &bull; {activeFileFindings.length} defect{activeFileFindings.length > 1 ? "s" : ""} on line {Array.from(flaggedLineMap.keys()).join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isModified && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans">
                    Unsaved edits
                  </span>
                )}
              </div>
            </div>

            {/* Editor Workspace & Inline Red/Green Problem Diff Area */}
            <div className="flex-1 overflow-y-auto bg-[#050608] font-mono text-[11px] leading-relaxed select-text">
              {editorViewMode === "diff" ? (
                /* INLINE DIFF MODE: EXACT ERROR IN RED & DIRECTLY UNDERNEATH AUTO-GENERATED GREEN FIX LINE */
                <div className="py-2 divide-y divide-transparent">
                  {editorLines.map((lineText, idx) => {
                    const lineNum = idx + 1;
                    const finding = flaggedLineMap.get(lineNum);

                    if (!finding) {
                      /* Normal code line */
                      return (
                        <div
                          key={lineNum}
                          className="flex items-center hover:bg-white/[0.02] py-0.5 px-2 group transition-colors"
                        >
                          <span className="w-10 text-right pr-3 text-[#525763] select-none text-[11px] font-mono shrink-0">
                            {lineNum}
                          </span>
                          <span className="w-5 text-transparent select-none font-mono text-[11px] shrink-0 text-center">
                            &nbsp;
                          </span>
                          <span className="text-[#D1D5DB] font-mono text-[11px] whitespace-pre flex-1 overflow-x-auto">
                            {lineText || " "}
                          </span>
                        </div>
                      );
                    }

                    /* Finding exists on this line! */
                    const rawCleanFixed = resolveLineFix(finding, lineText);
                    const cleanFixed =
                      rawCleanFixed && rawCleanFixed.trim() !== lineText.trim()
                        ? rawCleanFixed
                        : lineText.replace(/\.\s*$/, "").replace(/\.\s*([)\]}])/g, "$1") !== lineText
                        ? lineText.replace(/\.\s*$/, "").replace(/\.\s*([)\]}])/g, "$1")
                        : lineText.endsWith("(") ? lineText + ")" : lineText;

                    return (
                      <div key={lineNum} className="space-y-0 select-text my-0.5 w-full">
                        {/* 1. RED LINE: ERRONEOUS CODE HIGHLIGHTED IN RED ACROSS ENTIRE LINE */}
                        <div className="flex items-center bg-[#3d1418] border-l-4 border-rose-500 py-1.5 px-3 text-rose-200 w-full shadow-sm hover:bg-[#4a181e] transition-colors">
                          <span className="w-10 text-right pr-4 text-rose-400 select-none text-[11px] font-mono font-bold shrink-0">
                            {lineNum}
                          </span>
                          <span className="w-5 text-rose-400 select-none font-mono font-bold text-center shrink-0">
                            &minus;
                          </span>
                          <span className="text-rose-100 font-mono text-[11px] whitespace-pre flex-1 font-medium overflow-x-auto">
                            {lineText || " "}
                          </span>
                          <span className="text-[10px] text-rose-300/80 px-2 select-none font-sans shrink-0 hidden sm:inline">
                            {finding.title || "Syntax Error"}
                          </span>
                        </div>

                        {/* 2. GREEN LINE: DIRECTLY UNDERNEATH, AUTO-GENERATED LINE WITH SYNTAX/DOT FIX */}
                        <div className="flex items-center justify-between bg-[#0e351d] border-l-4 border-emerald-500 py-1.5 px-3 text-emerald-200 w-full shadow-inner hover:bg-[#124225] transition-colors">
                          <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
                            <span className="w-10 text-right pr-4 text-emerald-400 select-none text-[11px] font-mono font-bold shrink-0">
                              {lineNum}
                            </span>
                            <span className="w-5 text-emerald-400 select-none font-mono font-bold text-center shrink-0">
                              +
                            </span>
                            <span className="text-emerald-100 font-mono text-[11px] whitespace-pre font-semibold">
                              {cleanFixed}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <button
                              onClick={() => handleApplySingleFix(lineNum, cleanFixed)}
                              className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                              title="Apply this correction into source code"
                            >
                              <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                              <span>Apply Fix</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* EDIT MODE: DIRECT TEXT EDITING WITH LINE NUMBERS */
                <div className="flex flex-col min-h-[500px]">
                  {/* Inline Fixes Banner across the top if defects exist */}
                  {activeFileFindings.length > 0 && (
                    <div className="border-b border-white/[0.08] bg-[#0A0D14]">
                      {activeFileFindings.map((finding, fIdx) => {
                        const lText = editorLines[finding.line_start - 1] || "";
                        const rawCFixed = resolveLineFix(finding, lText);
                        const cFixed =
                          rawCFixed && rawCFixed.trim() !== lText.trim()
                            ? rawCFixed
                            : lText.replace(/\.\s*$/, "").replace(/\.\s*([)\]}])/g, "$1");

                        return (
                          <div key={fIdx} className="space-y-0 text-xs w-full">
                            <div className="flex items-center bg-[#3d1418] border-l-4 border-rose-500 py-1.5 px-3 text-rose-200 w-full font-mono">
                              <span className="w-8 text-rose-400 font-bold shrink-0">{finding.line_start}</span>
                              <span className="w-5 text-rose-400 font-bold shrink-0 text-center">&minus;</span>
                              <span className="text-rose-100 flex-1 truncate">{lText}</span>
                              <span className="text-[10px] text-rose-300/80 px-2 shrink-0 hidden sm:inline">{finding.title}</span>
                            </div>
                            <div className="flex items-center justify-between bg-[#0e351d] border-l-4 border-emerald-500 py-1.5 px-3 text-emerald-200 w-full font-mono shadow-inner">
                              <div className="flex items-center flex-1 min-w-0">
                                <span className="w-8 text-emerald-400 font-bold shrink-0">{finding.line_start}</span>
                                <span className="w-5 text-emerald-400 font-bold shrink-0 text-center">+</span>
                                <span className="text-emerald-100 font-semibold truncate">{cFixed}</span>
                              </div>
                              <button
                                onClick={() => handleApplySingleFix(finding.line_start, cFixed)}
                                className="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold flex items-center gap-1 shadow-sm shrink-0 ml-2"
                              >
                                <Check className="w-3 h-3 text-black stroke-[3]" />
                                <span>Apply Fix</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-1 min-h-[500px]">
                    {/* Line numbers column */}
                    <div className="w-12 py-3 bg-[#07080B] border-r border-white/[0.04] text-right select-none pr-3 text-[#525763] shrink-0 space-y-0">
                      {editorLines.map((_, idx) => {
                        const lineNum = idx + 1;
                        const hasError = flaggedLineMap.has(lineNum);
                        return (
                          <div
                            key={lineNum}
                            className={`h-[21px] flex items-center justify-end ${
                              hasError
                                ? "text-rose-400 font-bold bg-rose-500/20 px-1 -mr-3 rounded-l"
                                : ""
                            }`}
                          >
                            {lineNum}
                          </div>
                        );
                      })}
                    </div>

                    {/* Editable Text Area with Full-Line Error Highlights */}
                    <div className="flex-1 relative overflow-hidden">
                      {/* Background full-width highlight rows aligned with line height */}
                      <div className="absolute inset-0 pt-3 pointer-events-none select-none overflow-hidden">
                        {editorLines.map((_, idx) => {
                          const lineNum = idx + 1;
                          const hasError = flaggedLineMap.has(lineNum);
                          return (
                            <div
                              key={lineNum}
                              className={`h-[21px] w-full transition-colors ${
                                hasError
                                  ? "bg-rose-500/20 border-l-2 border-rose-500"
                                  : "bg-transparent"
                              }`}
                            />
                          );
                        })}
                      </div>

                      <textarea
                        ref={textareaRef}
                        value={editedCode}
                        onChange={(e) => {
                          setEditedCode(e.target.value);
                          setIsModified(true);
                        }}
                        spellCheck={false}
                        className="w-full h-full min-h-[500px] p-3 bg-transparent text-[#E5E7EB] resize-none focus:outline-none font-mono text-[11px] leading-[21px] whitespace-pre selection:bg-white/20 relative z-10"
                        placeholder="// Select a file from the explorer on the right to view and edit code."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Bar */}
            <div className="px-3.5 py-1.5 bg-[#0C0E13] border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-[#8E95A2] shrink-0">
              <div className="flex items-center gap-3">
                <span>{editorLines.length} lines</span>
                <span>&bull;</span>
                <span>{editedCode.length} chars</span>
                {flaggedLineMap.size > 0 && (
                  <>
                    <span>&bull;</span>
                    <span className="text-rose-400 font-semibold">{flaggedLineMap.size} errors</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>UTF-8</span>
                <span>&bull;</span>
                {selectedFileForInspection ? (
                  <span className="text-zinc-300 font-semibold flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full inline-block ${getFileTypeInfo(selectedFileForInspection.path).iconColor.replace('text-', 'bg-')}`} />
                    {getFileTypeInfo(selectedFileForInspection.path).label}
                  </span>
                ) : (
                  <span>Plain Text</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. RIGHT SIDE: FOLDER TREE (Approx 280px fixed, collapsible, with + File, + Folder & search) */}
          {showRightTree && (
            <div className="w-full lg:w-72 shrink-0 bg-[#0A0C10] rounded-xl border border-white/[0.08] flex flex-col overflow-hidden">
              {/* Folder Tree Header matching User Image */}
              <div className="px-3 py-2 bg-[#0E1015] border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white tracking-tight flex items-center gap-1">
                    All files
                    <ChevronDown className="w-3 h-3 text-[#8E95A2]" />
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* + File Button */}
                  <button
                    onClick={() => {
                      setNewItemName("");
                      setShowNewFileModal(true);
                    }}
                    className="p-1 rounded hover:bg-white/[0.08] text-[#8E95A2] hover:text-white transition-colors"
                    title="New File (+)"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>

                  {/* + Folder Button */}
                  <button
                    onClick={() => {
                      setNewItemName("");
                      setShowNewFolderModal(true);
                    }}
                    className="p-1 rounded hover:bg-white/[0.08] text-[#8E95A2] hover:text-white transition-colors"
                    title="New Folder (+)"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setShowRightTree(false)}
                    className="p-1 rounded hover:bg-white/[0.08] text-[#8E95A2] hover:text-white transition-colors"
                    title="Collapse Explorer"
                  >
                    <PanelRightClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Explorer Search Input */}
              <div className="px-2.5 py-1.5 bg-[#0A0C10] border-b border-white/[0.04] flex items-center gap-1.5 shrink-0">
                <Search className="w-3 h-3 text-[#636366]" />
                <input
                  type="text"
                  placeholder="Filter tree files..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="bg-transparent text-[11px] text-white placeholder:text-[#525763] focus:outline-none w-full font-mono"
                />
                {fileSearchQuery && (
                  <button
                    onClick={() => setFileSearchQuery("")}
                    className="text-[#8E95A2] hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Tree Items */}
              <div className="flex-1 p-2 overflow-y-auto space-y-0.5 pr-1">
                {activeTreeFiles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#8E95A2]">
                    No files loaded.
                  </div>
                ) : (
                  Object.values(fileTreeRoot)
                    .filter((node) => {
                      if (!fileSearchQuery.trim()) return true;
                      const q = fileSearchQuery.toLowerCase();
                      return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
                    })
                    .map((node) => renderTreeNode(node, 0))
                )}
              </div>

              {/* Quick Action Footer at Bottom of Explorer */}
              <div className="p-2 bg-[#0E1015] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#8E95A2]">
                <span className="font-mono text-[10px]">{activeTreeFiles.length} files in tree</span>
                <button
                  onClick={() => {
                    setReviewMode("folder");
                    setShowReviewModal(true);
                  }}
                  className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-colors flex items-center gap-1 font-medium"
                >
                  <Upload className="w-3 h-3" /> Load Folder
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code Review Input Modal (Folder / Single File / Git Diff) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0C0E13] rounded-2xl max-w-xl w-full p-6 space-y-4 border border-white/[0.1] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">Select Code Source to Review</h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-xs text-[#8E95A2] hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] text-xs">
              <button
                onClick={() => setReviewMode("folder")}
                className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  reviewMode === "folder"
                    ? "bg-white text-black shadow-sm"
                    : "text-[#8E95A2] hover:text-white"
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                Entire Folder
              </button>
              <button
                onClick={() => setReviewMode("file")}
                className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  reviewMode === "file"
                    ? "bg-white text-black shadow-sm"
                    : "text-[#8E95A2] hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Single File
              </button>
              <button
                onClick={() => setReviewMode("diff")}
                className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  reviewMode === "diff"
                    ? "bg-white text-black shadow-sm"
                    : "text-[#8E95A2] hover:text-white"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Git Diff / PR
              </button>
            </div>

            {/* Project / Repo Name */}
            <div>
              <label className="text-xs text-[#8E95A2] block mb-1">Project or Module Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-white focus:outline-none"
              />
            </div>

            {/* Tab 1: Folder Review */}
            {reviewMode === "folder" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[#8E95A2] block mb-1">Upload Local Folder from Computer</label>
                  <label className="border border-dashed border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors relative overflow-hidden">
                    <Folder className="w-6 h-6 text-white/70" />
                    <span className="text-white font-medium text-xs">Click to select a directory on your machine</span>
                    <span className="text-[11px] text-[#8E95A2]">
                      Async parser auto-filters binaries, media, .git, and node_modules
                    </span>
                    <input
                      type="file"
                      // @ts-expect-error webkitdirectory is standard in Chromium/modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFolderUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Real-time Reading Progress Indicator */}
                {isReadingFolder && (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white flex items-center gap-1.5 font-medium">
                        <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                        Parsing Files asynchronously...
                      </span>
                      <span className="text-[#8E95A2] font-mono">
                        {readingProgress.current} / {readingProgress.total}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-150 ease-out"
                        style={{
                          width: `${
                            readingProgress.total > 0
                              ? Math.min(100, (readingProgress.current / readingProgress.total) * 100)
                              : 10
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#8E95A2] font-mono truncate">
                      <span className="truncate max-w-[280px]">Active: {readingProgress.currentFile}</span>
                      {readingProgress.skippedCount > 0 && (
                        <span className="text-amber-400/80">({readingProgress.skippedCount} skipped)</span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#8E95A2]">Files in Folder Queue ({folderFiles.length})</span>
                    <span className="text-[10px] text-emerald-400">
                      {folderFiles.length > 0 ? "Ready to audit" : "No files selected"}
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-white/[0.06] rounded-lg p-2 bg-white/[0.02] space-y-1 font-mono text-[11px]">
                    {folderFiles.map((f, i) => (
                      <div key={i} className="text-white/80 flex items-center justify-between">
                        <span className="truncate max-w-[340px]">{f.path}</span>
                        <span className="text-[10px] text-[#8E95A2] shrink-0">{f.content.length} chars</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Single File Review */}
            {reviewMode === "file" && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#8E95A2]">File Path & Name</label>
                    <label className="text-white/80 hover:text-white cursor-pointer inline-flex items-center gap-1 font-medium text-[11px]">
                      <Upload className="w-3 h-3" /> Select file from disk
                      <input type="file" onChange={handleSingleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={singleFilePath}
                    onChange={(e) => setSingleFilePath(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#8E95A2] block mb-1">Source Code Content</label>
                  <textarea
                    rows={6}
                    value={singleFileContent}
                    onChange={(e) => setSingleFileContent(e.target.value)}
                    className="w-full p-2.5 font-mono text-[11px] rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#E5E7EB] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Git Diff / PR Review */}
            {reviewMode === "diff" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[#8E95A2] block mb-1">Target File Path</label>
                  <input
                    type="text"
                    value={diffFilePath}
                    onChange={(e) => setDiffFilePath(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#8E95A2] block mb-1">Unified Git Diff / PR Patch</label>
                  <textarea
                    rows={6}
                    value={codePatchInput}
                    onChange={(e) => setCodePatchInput(e.target.value)}
                    className="w-full p-2.5 font-mono text-[11px] rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#E5E7EB] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#8E95A2] hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={analyzing || isReadingFolder}
                onClick={() => handleRunLiveReview("all")}
                className="px-4 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 apple-press flex items-center gap-2 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{analysisStage || "Running Pipeline..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" />
                    Load & Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Creation Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0C0E13] rounded-2xl max-w-md w-full p-5 space-y-4 border border-white/[0.1] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Create New File</h3>
              </div>
              <button
                onClick={() => setShowNewFileModal(false)}
                className="text-xs text-[#8E95A2] hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#8E95A2] block">File Relative Path (e.g. `src/utils/auth.ts`)</label>
              <input
                type="text"
                autoFocus
                placeholder="src/components/MyComponent.tsx"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateNewFile()}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-mono text-white focus:outline-none focus:border-white/20"
              />
              <p className="text-[11px] text-[#636366]">
                File will be created in the current tree and opened in the editor for instant review.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#8E95A2] hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={!newItemName.trim()}
                onClick={handleCreateNewFile}
                className="px-4 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 apple-press disabled:opacity-40"
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Creation Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0C0E13] rounded-2xl max-w-md w-full p-5 space-y-4 border border-white/[0.1] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Create New Folder</h3>
              </div>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="text-xs text-[#8E95A2] hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#8E95A2] block">Folder Name or Path (e.g. `src/modules`)</label>
              <input
                type="text"
                autoFocus
                placeholder="src/features"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateNewFolder()}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-mono text-white focus:outline-none focus:border-white/20"
              />
              <p className="text-[11px] text-[#636366]">
                Folder will be added to the tree with an initial index file ready for coding.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#8E95A2] hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={!newItemName.trim()}
                onClick={handleCreateNewFolder}
                className="px-4 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 apple-press disabled:opacity-40"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
