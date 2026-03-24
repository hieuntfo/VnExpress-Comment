import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  AlertCircle, CheckCircle, Trash2, Edit, RefreshCw, 
  ShieldAlert, ShieldCheck, Info, Database, Play,
  ChevronDown, Settings, User, LogOut, FileText, BarChart2, MessageSquare,
  CheckSquare, XSquare, Loader2
} from 'lucide-react';

interface AIResult {
  action_status: "AUTO_PUBLISH" | "HUMAN_REVIEW" | "AUTO_DELETE";
  risk_score: number;
  violation_type: "Theo nguyên tắc" | "Không phù hợp" | "None";
  highlight_words: string[];
  ai_reasoning: string;
}

interface Comment {
  id: string;
  username: string;
  email: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'published' | 'deleted';
  aiResult?: AIResult;
  deleteReason?: 'Theo nguyên tắc' | 'Không phù hợp';
}

interface TrainingLog {
  id: string;
  commentText: string;
  aiSuggestion: string;
  humanAction: string;
  humanReason?: string;
  timestamp: string;
}

const ARTICLE_TITLE = "Bộ Tài Chính Đề Xuất Giảm Một Nửa Thuế Môi Trường Với Xăng, Dầu";
const ARTICLE_CATEGORY = "Kinh doanh";

const initialComments: Comment[] = [
  {
    id: '1',
    username: 'Chien Hua',
    email: 'huangocchien@gmail.com',
    text: 'Thuế tiêu thụ đặc biệt với xăng nên bỏ',
    timestamp: 'Mar 24 13:04',
    status: 'pending'
  },
  {
    id: '2',
    username: 'jincrush',
    email: 'jincrush@gmail.com',
    text: 'Những lúc như này nên giảm về 0, và những khoản quỹ đã đóng hiện nên được sử dụng để bình ổn lại giá xăng dầu',
    timestamp: 'Mar 24 13:05',
    status: 'pending'
  },
  {
    id: '3',
    username: 'd5fwddhs2',
    email: 'd5fwddhs2@relay.firefox.com',
    text: 'đc 1/2 cơ đấy. ^_^',
    timestamp: 'Mar 24 13:08',
    status: 'pending'
  },
  {
    id: '4',
    username: 'nguoiquaduong',
    email: 'nguoiquaduong@gmail.com',
    text: 'Bọn ml này toàn bốc phét, giảm đc mấy đồng xong lại tăng vù vù. Lũ hút máu.',
    timestamp: 'Mar 24 13:10',
    status: 'pending'
  },
  {
    id: '5',
    username: 'spam_bot',
    email: 'bot@spam.com',
    text: 'Vay tiền nhanh không thế chấp liên hệ 0987654321, giải ngân trong 5 phút.',
    timestamp: 'Mar 24 13:12',
    status: 'pending'
  },
  {
    id: '6',
    username: 'thanhniennghiemtuc',
    email: 'tnnt@yahoo.com',
    text: 'Bài viết xàm xí, chả liên quan gì đến giá vàng cả.',
    timestamp: 'Mar 24 13:15',
    status: 'pending'
  },
  {
    id: '7',
    username: 'chuyengia',
    email: 'chuyengia@gmail.com',
    text: 'Đề xuất này rất hợp lý, tuy nhiên cần xem xét lại nguồn thu ngân sách bù đắp vào khoản hụt này.',
    timestamp: 'Mar 24 13:20',
    status: 'pending'
  },
  {
    id: '8',
    username: 'teencode_master',
    email: 'teen@gmail.com',
    text: 'giảm thuế cc gì, toàn lừa dân đen',
    timestamp: 'Mar 24 13:25',
    status: 'pending'
  }
];

const SYSTEM_INSTRUCTION = `Bạn là AI Kiểm duyệt Bình luận (Comment Moderation API) cấp cao, được tích hợp vào hệ thống CMS của một trang báo điện tử hàng đầu. Nhiệm vụ của bạn là tiền kiểm, phân tích ngữ cảnh, chấm điểm rủi ro và phân luồng bình luận của độc giả trên cả 2 phiên bản tiếng Việt và tiếng Anh.

Context:
- Bình luận phải tuân thủ chuẩn mực báo chí chính thống: Không văng tục, không kích động thù địch, không spam quảng cáo, không vi phạm pháp luật, và đặc biệt phải phù hợp với ngữ cảnh (Tiêu đề/Chuyên mục) của bài báo.
- Người dùng có thể dùng teencode, viết tắt, tiếng Việt không dấu, hoặc tiếng lóng để lách luật. Bạn cần có khả năng hiểu các biến thể này.

Task & Rules:
Phân tích comment_text kết hợp với article_title và phân loại vào 1 trong 3 trạng thái (action_status):
1. AUTO_PUBLISH: Bình luận hoàn toàn sạch, lịch sự, đóng góp giá trị, đi đúng trọng tâm bài viết. Không chứa từ ngữ nhạy cảm. (Điểm rủi ro < 20).
2. AUTO_DELETE: Bình luận vi phạm nghiêm trọng (chửi bới, phản động, spam link, chứa thông tin cá nhân/SĐT, công kích cá nhân thô tục). (Điểm rủi ro > 85).
3. HUMAN_REVIEW: Bình luận thuộc "vùng xám". Châm biếm ngầm, dùng từ lóng phức tạp, ý kiến trái chiều gay gắt nhưng không văng tục, hoặc có dấu hiệu lạc đề (Không phù hợp). Cần Biên tập viên duyệt thủ công. (Điểm rủi ro từ 20 đến 85).

Nếu vi phạm, phải xác định violation_type là:
- "Theo nguyên tắc": Vi phạm quy định cứng (Tục tĩu, thù địch, spam, vi phạm pháp luật).
- "Không phù hợp": Không vi phạm luật cứng nhưng lạc đề, không phù hợp ngữ cảnh bài viết, hoặc thông tin vô nghĩa.
- "None": Nếu không vi phạm.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action_status: {
      type: Type.STRING,
      enum: ["AUTO_PUBLISH", "HUMAN_REVIEW", "AUTO_DELETE"],
      description: "Trạng thái phân loại"
    },
    risk_score: {
      type: Type.INTEGER,
      description: "Điểm rủi ro từ 0 đến 100"
    },
    violation_type: {
      type: Type.STRING,
      enum: ["Theo nguyên tắc", "Không phù hợp", "None"],
      description: "Loại vi phạm"
    },
    highlight_words: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách các từ nghi ngờ cần bôi đỏ"
    },
    ai_reasoning: {
      type: Type.STRING,
      description: "Giải thích ngắn gọn lý do phân loại"
    }
  },
  required: ["action_status", "risk_score", "violation_type", "highlight_words", "ai_reasoning"]
};

const HighlightedText = ({ text, words }: { text: string, words: string[] }) => {
  if (!words || words.length === 0) return <span>{text}</span>;

  const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-red-200 text-red-900 font-semibold px-1 rounded-sm border border-red-300 shadow-sm">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const getAIStatusConfig = (status: string) => {
  switch (status) {
    case 'AUTO_PUBLISH':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: <ShieldCheck className="w-5 h-5 text-green-600" /> };
    case 'AUTO_DELETE':
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: <ShieldAlert className="w-5 h-5 text-red-600" /> };
    case 'HUMAN_REVIEW':
      return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: <AlertCircle className="w-5 h-5 text-yellow-600" /> };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', icon: <Info className="w-5 h-5 text-gray-600" /> };
  }
};

export default function App() {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'deleted'>('pending');

  // Selection states
  const [selectedVerify, setSelectedVerify] = useState<string[]>([]);
  const [selectedDelete, setSelectedDelete] = useState<{id: string, reason: 'Theo nguyên tắc' | 'Không phù hợp'}[]>([]);

  const pendingCount = comments.filter(c => c.status === 'pending').length;
  const filteredComments = comments.filter(c => filter === 'all' || c.status === filter);

  const runAIModeration = async () => {
    setIsRunningAI(true);
    try {
      // Hỗ trợ cả biến môi trường của AI Studio và Vercel (VITE_GEMINI_API_KEY)
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY') {
        alert("Lỗi: Không tìm thấy Gemini API Key.\n\nVì bạn đang deploy lên Vercel, vui lòng làm theo các bước sau:\n1. Vào Vercel Dashboard > Settings > Environment Variables\n2. Thêm biến mới với tên: VITE_GEMINI_API_KEY và giá trị là API Key của bạn.\n3. Chuyển sang tab Deployments và chọn Redeploy.");
        setIsRunningAI(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const pendingComments = comments.filter(c => c.status === 'pending' && !c.aiResult);
      
      const promises = pendingComments.map(async (comment) => {
        try {
          const prompt = JSON.stringify({
            article_category: ARTICLE_CATEGORY,
            article_title: ARTICLE_TITLE,
            comment_text: comment.text,
            language: "vi"
          });

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.1
            }
          });

          const resultText = response.text;
          if (resultText) {
             const aiResult = JSON.parse(resultText) as AIResult;
             return { ...comment, aiResult };
          }
        } catch (error) {
          console.error("AI Error for comment", comment.id, error);
        }
        return comment;
      });

      const processedComments = await Promise.all(promises);

      setComments(prevComments => prevComments.map(c => {
        const processed = processedComments.find(pc => pc.id === c.id);
        return processed ? processed : c;
      }));

    } catch (error) {
      console.error("Global AI Error:", error);
      alert("Có lỗi xảy ra khi gọi AI: " + (error as Error).message);
    } finally {
      setIsRunningAI(false);
    }
  };

  const handleAction = (id: string, action: 'publish' | 'delete', reason?: 'Theo nguyên tắc' | 'Không phù hợp') => {
    const comment = comments.find(c => c.id === id);
    if (!comment) return;

    let isOverride = false;
    if (comment.aiResult) {
      if (action === 'publish' && comment.aiResult.action_status !== 'AUTO_PUBLISH') isOverride = true;
      if (action === 'delete' && comment.aiResult.action_status !== 'AUTO_DELETE') isOverride = true;
    }

    if (isOverride) {
      const logEntry: TrainingLog = {
        id: Math.random().toString(36).substr(2, 9),
        commentText: comment.text,
        aiSuggestion: comment.aiResult?.action_status || 'UNKNOWN',
        humanAction: action.toUpperCase(),
        humanReason: reason,
        timestamp: new Date().toISOString()
      };
      setTrainingLogs(prev => [logEntry, ...prev]);
    }

    setComments(prev => prev.map(c => 
      c.id === id ? { ...c, status: action === 'publish' ? 'published' : 'deleted', deleteReason: reason } : c
    ));
  };

  const handleBulkVerify = () => {
    if (selectedVerify.length === 0) {
      alert("Vui lòng chọn ít nhất một bình luận (tích vào ô Verify) để duyệt.");
      return;
    }
    if (window.confirm("Are you sure to publish this comment?")) {
      setIsProcessing(true);
      setTimeout(() => {
        selectedVerify.forEach(id => handleAction(id, 'publish'));
        setSelectedVerify([]);
        setIsProcessing(false);
      }, 800);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDelete.length === 0) {
      alert("Vui lòng chọn ít nhất một bình luận (tích vào ô lý do Delete) để xóa.");
      return;
    }
    if (window.confirm("Are you sure to delete this comment?")) {
      setIsProcessing(true);
      setTimeout(() => {
        selectedDelete.forEach(item => handleAction(item.id, 'delete', item.reason));
        setSelectedDelete([]);
        setIsProcessing(false);
      }, 800);
    }
  };

  const handleUpdateText = (id: string, newText: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  const toggleVerifySelection = (id: string) => {
    setSelectedVerify(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
    // Uncheck delete if verify is checked
    setSelectedDelete(prev => prev.filter(item => item.id !== id));
  };

  const toggleDeleteSelection = (id: string, reason: 'Theo nguyên tắc' | 'Không phù hợp') => {
    setSelectedDelete(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing && existing.reason === reason) {
        return prev.filter(item => item.id !== id); // Uncheck
      }
      return [...prev.filter(item => item.id !== id), { id, reason }]; // Check new reason
    });
    // Uncheck verify if delete is checked
    setSelectedVerify(prev => prev.filter(item => item !== id));
  };

  const pendingFilteredComments = filteredComments.filter(c => c.status === 'pending');

  const isAllVerifyChecked = pendingFilteredComments.length > 0 && pendingFilteredComments.every(c => selectedVerify.includes(c.id));
  const isAllDeleteChecked = pendingFilteredComments.length > 0 && pendingFilteredComments.every(c => selectedDelete.some(d => d.id === c.id));

  const toggleAllVerify = () => {
    if (isAllVerifyChecked) {
      setSelectedVerify([]);
    } else {
      setSelectedVerify(pendingFilteredComments.map(c => c.id));
      setSelectedDelete([]);
    }
  };

  const toggleAllDelete = () => {
    if (isAllDeleteChecked) {
      setSelectedDelete([]);
    } else {
      setSelectedDelete(pendingFilteredComments.map(c => ({ id: c.id, reason: 'Theo nguyên tắc' })));
      setSelectedVerify([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex font-sans text-sm relative">
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <span className="text-xl font-semibold">Đang xử lý</span>
        </div>
      )}

      {/* Sidebar - Classic CMS Look */}
      <div className="w-56 bg-[#e0e0e0] border-r border-gray-300 flex flex-col">
        <div className="p-3 border-b border-gray-300 bg-white">
          <img src="https://s1.vnecdn.net/vnexpress/restruct/i/v863/v2_2019/pc/graphics/logo.svg" alt="VnExpress" className="h-6" />
          <div className="text-[10px] text-gray-500 mt-1">Báo tiếng Việt nhiều người xem nhất</div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1 font-bold text-gray-800 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" /> Newsroom
          </div>
          <div className="px-3 py-1 font-bold text-gray-800 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" /> Publish
          </div>
          <div className="pl-6 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">- Editor</div>
          <div className="pl-6 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">- Manager</div>
          <div className="pl-6 pr-3 py-1 font-semibold text-gray-800 bg-gray-300 flex items-center justify-between">
            <span>- Manage Comment</span>
          </div>
          <div className="pl-10 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">Firewall</div>
          <div className="pl-10 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">Bad words</div>
          <div className="pl-10 pr-3 py-1 text-gray-700 font-bold bg-white border-y border-gray-300">Verify</div>
          <div className="pl-10 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">Publish</div>
          <div className="pl-10 pr-3 py-1 text-gray-700 hover:bg-gray-200 cursor-pointer">Published</div>
          
          <div className="px-3 py-1 font-bold text-gray-800 flex items-center gap-1 mt-2">
            <ChevronDown className="w-3 h-3" /> Manage Materials
          </div>
          <div className="px-3 py-1 font-bold text-gray-800 flex items-center gap-1 mt-2">
            <ChevronDown className="w-3 h-3" /> Statistics
          </div>
        </div>

        <div className="p-3 border-t border-gray-300 text-xs bg-gray-200">
          <div className="font-bold">HieuNguyen (Logout)</div>
          <div className="text-blue-600 hover:underline cursor-pointer">Account Setting</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {/* Top Header */}
        <div className="p-2 border-b border-gray-300 bg-gray-50 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-600">List Comment: </span>
            <span className="font-bold text-blue-800">{ARTICLE_TITLE} - Try To Fix Comment</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowLogs(true)}
              className="flex items-center gap-1 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded border border-purple-300 hover:bg-purple-200"
            >
              <Database className="w-3 h-3" />
              Training Logs ({trainingLogs.length})
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-2 border-b border-gray-300 bg-white flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <div className="bg-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold border border-yellow-400">
                Có {pendingCount} bài mới chưa được xử lý
              </div>
            )}
            <div className="bg-yellow-200 text-yellow-800 px-3 py-1 text-xs font-bold border border-yellow-400">
              Có 2 bài có comment publishing chưa được xử lý
            </div>
            <button 
              onClick={runAIModeration}
              disabled={isRunningAI || pendingCount === 0}
              className="ml-auto flex items-center gap-1 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunningAI ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {isRunningAI ? 'AI Đang Quét...' : 'Chạy AI Tiền Kiểm'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => alert("Chức năng Back đang được phát triển.")} className="border border-gray-400 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-bold">Back</button>
              <button onClick={handleBulkDelete} className="border border-gray-400 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-bold">Delete</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleBulkVerify} className="border border-gray-400 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-bold">Verify</button>
              <button onClick={() => alert("Chức năng Export Excel đang được phát triển.")} className="border border-gray-400 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-bold">Export Excel</button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Type Comment:</span>
              <select className="border border-gray-300 px-1 py-0.5 bg-white"><option>All Comment</option></select>
              <span>User type:</span>
              <select className="border border-gray-300 px-1 py-0.5 bg-white"><option>All type</option></select>
              <span>Status:</span>
              <select 
                className="border border-gray-300 px-1 py-0.5 bg-white"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="pending">Verify</option>
                <option value="published">Published</option>
                <option value="deleted">Deleted</option>
              </select>
              <span>Sort by:</span>
              <select className="border border-gray-300 px-1 py-0.5 bg-white"><option>Oldest comments</option></select>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex bg-[#990000] text-white text-xs font-bold border-b border-gray-300">
          <div className="w-10 p-2 text-center border-r border-red-800">No.</div>
          <div className="w-32 p-2 text-center border-r border-red-800 flex items-center justify-center gap-2">
            <input type="checkbox" checked={isAllDeleteChecked} onChange={toggleAllDelete} className="cursor-pointer" />
            Delete
          </div>
          <div className="w-16 p-2 text-center border-r border-red-800 flex items-center justify-center gap-2">
            <input type="checkbox" checked={isAllVerifyChecked} onChange={toggleAllVerify} className="cursor-pointer" />
            Verify
          </div>
          <div className="flex-1 p-2 text-center border-r border-red-800">Comment</div>
          <div className="w-24 p-2 text-center">Creation Time</div>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto bg-white space-y-0">
          {filteredComments.map((comment, index) => (
            <CommentRow 
              key={comment.id} 
              index={index + 1} 
              comment={comment} 
              onAction={handleAction}
              onUpdateText={handleUpdateText}
              isSelectedVerify={selectedVerify.includes(comment.id)}
              selectedDeleteReason={selectedDelete.find(d => d.id === comment.id)?.reason}
              onToggleVerify={() => toggleVerifySelection(comment.id)}
              onToggleDelete={(reason) => toggleDeleteSelection(comment.id, reason)}
            />
          ))}
          {filteredComments.length === 0 && (
            <div className="text-center p-8 text-gray-500">Không có bình luận nào trong mục này.</div>
          )}
        </div>
      </div>

      {/* Training Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-[800px] max-h-[80vh] flex flex-col shadow-2xl rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-600" />
                Kho Dữ Liệu Học Tăng Cường (Reinforcement Learning)
              </h2>
              <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-gray-800">
                <XSquare className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 bg-purple-50 text-purple-800 text-sm border-b border-purple-100">
              Hệ thống ghi nhận các trường hợp Biên tập viên (Human) có quyết định khác với gợi ý của AI. 
              Dữ liệu này sẽ được dùng để fine-tune mô hình định kỳ, giúp AI hiểu rõ hơn "khẩu vị" kiểm duyệt của tòa soạn.
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {trainingLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Chưa có dữ liệu override nào được ghi nhận.</div>
              ) : (
                trainingLogs.map(log => (
                  <div key={log.id} className="border border-gray-200 rounded p-3 bg-white shadow-sm">
                    <div className="text-xs text-gray-500 mb-2">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="bg-gray-50 p-2 rounded border border-gray-100 mb-3 text-sm">
                      "{log.commentText}"
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1 bg-red-50 text-red-800 p-2 rounded border border-red-100">
                        <span className="font-semibold block mb-1">AI Suggestion:</span>
                        {log.aiSuggestion}
                      </div>
                      <div className="flex-1 bg-green-50 text-green-800 p-2 rounded border border-green-100">
                        <span className="font-semibold block mb-1">Human Override:</span>
                        {log.humanAction} {log.humanReason ? `(${log.humanReason})` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ 
  index, 
  comment, 
  onAction,
  onUpdateText,
  isSelectedVerify,
  selectedDeleteReason,
  onToggleVerify,
  onToggleDelete
}: { 
  index: number, 
  comment: Comment, 
  onAction: (id: string, action: 'publish' | 'delete', reason?: 'Theo nguyên tắc' | 'Không phù hợp') => void,
  onUpdateText: (id: string, text: string) => void,
  isSelectedVerify: boolean,
  selectedDeleteReason?: 'Theo nguyên tắc' | 'Không phù hợp',
  onToggleVerify: () => void,
  onToggleDelete: (reason: 'Theo nguyên tắc' | 'Không phù hợp') => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const aiConfig = comment.aiResult ? getAIStatusConfig(comment.aiResult.action_status) : null;

  return (
    <div className={`flex border-b border-gray-300 ${comment.status !== 'pending' ? 'opacity-60 grayscale-[30%] bg-gray-50' : 'bg-white'}`}>
      {/* No. */}
      <div className="w-10 p-2 text-center border-r border-gray-200 text-gray-800 font-bold flex items-center justify-center">
        {index}
      </div>

      {/* Delete Reasons */}
      <div className="w-32 p-2 border-r border-gray-200 flex flex-col gap-2 justify-center">
        <label className="flex items-start gap-1.5 text-[11px] cursor-pointer">
          <input 
            type="checkbox" 
            className="mt-0.5" 
            checked={selectedDeleteReason === 'Theo nguyên tắc'}
            onChange={() => onToggleDelete('Theo nguyên tắc')}
            disabled={comment.status !== 'pending'}
          />
          <span className="leading-tight">Theo nguyên tắc</span>
        </label>
        <label className="flex items-start gap-1.5 text-[11px] cursor-pointer">
          <input 
            type="checkbox" 
            className="mt-0.5"
            checked={selectedDeleteReason === 'Không phù hợp'}
            onChange={() => onToggleDelete('Không phù hợp')}
            disabled={comment.status !== 'pending'}
          />
          <div className="flex flex-col leading-tight">
            <span>Không phù hợp</span>
            <span className="text-[9px] text-gray-400 italic mt-0.5">(Liên quan quy định theo thời điểm)</span>
          </div>
        </label>
      </div>

      {/* Verify Checkbox */}
      <div className="w-16 p-2 border-r border-gray-200 flex items-center justify-center">
        <input 
          type="checkbox" 
          className="w-4 h-4 cursor-pointer"
          checked={isSelectedVerify}
          onChange={onToggleVerify}
          disabled={comment.status !== 'pending'}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-3 flex flex-col">
        
        {/* AI Panel (Only show if AI has processed) */}
        {comment.aiResult && aiConfig && (
          <div className={`mb-3 p-2.5 rounded border ${aiConfig.bg} ${aiConfig.border} flex items-start gap-3`}>
            <div className="mt-0.5">{aiConfig.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm ${aiConfig.text}`}>
                  AI Gợi ý: {comment.aiResult.action_status}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 font-semibold border border-black/5">
                  Rủi ro: {comment.aiResult.risk_score}%
                </span>
                {comment.aiResult.violation_type !== 'None' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold border border-red-200">
                    Lỗi: {comment.aiResult.violation_type}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 text-gray-700 font-medium">
                Lý do: {comment.aiResult.ai_reasoning}
              </p>
            </div>
          </div>
        )}

        {/* Text Area */}
        <div className="relative flex-1 mb-2">
          {isEditing ? (
            <textarea
              className="w-full h-full min-h-[80px] border border-blue-400 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 shadow-inner resize-y"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              onBlur={() => {
                setIsEditing(false);
                if (editText !== comment.text) onUpdateText(comment.id, editText);
              }}
            />
          ) : (
            <div 
              className="w-full min-h-[80px] border border-gray-300 p-2 text-sm bg-white cursor-text hover:border-gray-400 transition-colors shadow-sm"
              onClick={() => {
                if (comment.status === 'pending') setIsEditing(true);
              }}
            >
              <HighlightedText text={comment.text} words={comment.aiResult?.highlight_words || []} />
            </div>
          )}
        </div>

        {/* User Info & Actions (Below the box) */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#990000] rounded flex items-center justify-center text-white font-bold text-[10px]">
              {comment.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-[#990000] text-xs">{comment.username}</span>
            <span className="text-gray-500 text-xs">({comment.email})</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {comment.status === 'pending' ? (
              <>
                <button 
                  className="hover:underline" 
                  onClick={() => {
                    if (window.confirm("Are you sure to publish this comment?")) {
                      onAction(comment.id, 'publish');
                    }
                  }}
                >
                  [ Verify ]
                </button>
                <span>-</span>
                <button className="hover:underline" onClick={() => alert("Chức năng xem Log chi tiết đang được phát triển.")}>[ Log ]</button>
                <span>-</span>
                <button 
                  className="hover:underline" 
                  onClick={() => {
                    if (!selectedDeleteReason) {
                      alert("Vui lòng chọn lý do xóa (Theo nguyên tắc / Không phù hợp) ở cột bên trái trước khi xóa.");
                      return;
                    }
                    if (window.confirm("Are you sure to delete this comment?")) {
                      onAction(comment.id, 'delete', selectedDeleteReason);
                    }
                  }}
                >
                  [ Delete ]
                </button>
              </>
            ) : (
              <span className={`px-2 py-1 rounded text-white font-bold ${comment.status === 'published' ? 'bg-green-600' : 'bg-red-600'}`}>
                {comment.status.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Creation Time */}
      <div className="w-24 p-2 border-l border-gray-200 flex items-center justify-center text-[11px] text-gray-500">
        {comment.timestamp}
      </div>
    </div>
  );
}
