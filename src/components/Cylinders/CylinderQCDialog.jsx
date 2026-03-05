import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabase/config';

export default function CylinderQCDialog({ isOpen, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setParsedData(null);
        setIsParsing(true);

        try {
            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Get raw 2D array
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let metadata = {
                product_type: '',
                standard: '',
                material: '',
                batch_no: '',
                test_pressure: '',
                hold_time: ''
            };

            const findValueNextTo = (keywordStrs) => {
                const keywords = Array.isArray(keywordStrs) ? keywordStrs : [keywordStrs];
                for (let r = 0; r < Math.min(20, rawData.length); r++) {
                    const row = rawData[r];
                    if (!row) continue;
                    for (let c = 0; c < row.length; c++) {
                        const cell = String(row[c] || '').toLowerCase();
                        // Check if cell contains any of the keywords
                        const hasKeyword = keywords.some(kw => cell.includes(kw.toLowerCase()));
                        if (hasKeyword) {
                            // Find the first non-empty cell to the right
                            for (let i = c + 1; i < row.length; i++) {
                                const val = String(row[i] || '').trim();
                                if (val) return val;
                            }
                        }
                    }
                }
                return '';
            };

            metadata.product_type = findValueNextTo(['Product type', '规格型号']);
            metadata.standard = findValueNextTo(['Standard', '执行标准', 'ISO']);
            metadata.material = findValueNextTo(['Material', '材质']);
            metadata.batch_no = findValueNextTo(['Batch No', 'Batch', '批次']);
            metadata.test_pressure = findValueNextTo(['Test Pressure', '试验压力']);
            metadata.hold_time = findValueNextTo(['Hold time', '保压时间', '保压']);

            // 2. Extract Cylinder Rows
            const records = [];
            // We know the factory table has 2 halves in the same rows.
            // Let's just scan every row for cells that look like our data.
            // A row might have: [TN12801, 7.52, 8.18, OK, TN12826, 7.54, 8.16, OK]
            // We can look for cells matching our prefix (e.g. TN or JD or KD or just containing numbers > 1000)

            for (let r = 0; r < rawData.length; r++) {
                const row = rawData[r];
                if (!row) continue;

                // Process the row in chunks of 4 if possible, or just scan linearly
                for (let c = 0; c < row.length; c++) {
                    const cell = String(row[c] || '').trim();
                    // Basic heuristic: if it looks like a serial number (alphanumeric, 5+ chars, not a header)
                    // You can adjust this regex based on your serial number format
                    if (/^[A-Za-z]+[0-9]{4,}/.test(cell) || /^[A-Z0-9]{6,}$/.test(cell)) {
                        // Looks like a serial number. Check next cols for numbers
                        if (c + 3 < row.length) {
                            const weightStr = String(row[c + 1] || '').replace(',', '.');
                            const capStr = String(row[c + 2] || '').replace(',', '.');
                            const weight = parseFloat(weightStr);
                            const cap = parseFloat(capStr);

                            if (!isNaN(weight) && !isNaN(cap)) {
                                records.push({
                                    serial_number: cell,
                                    empty_weight: weight,
                                    water_capacity: cap,
                                    conclusion: String(row[c + 3] || 'OK')
                                });
                                // Skip the parsed cells to avoid double counting
                                c += 3;
                            }
                        }
                    }
                }
            }

            if (records.length === 0) {
                throw new Error("Không tìm thấy dữ liệu kiểm định hợp lệ trong file. Vui lòng kiểm tra lại cấu trúc file mẫu.");
            }

            setParsedData({ metadata, records });
        } catch (err) {
            console.error('Parse error:', err);
            setError(err.message || "Lỗi khi đọc file. Hãy chọn file Excel (.xlsx) đúng định dạng.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleUpload = async () => {
        if (!parsedData || parsedData.records.length === 0) return;
        setIsUploading(true);
        setError(null);

        try {
            // Prepare payload
            const payload = parsedData.records.map(rec => ({
                serial_number: rec.serial_number,
                batch_no: parsedData.metadata.batch_no || null,
                product_type: parsedData.metadata.product_type || null,
                standard: parsedData.metadata.standard || null,
                material: parsedData.metadata.material || null,
                test_pressure: parsedData.metadata.test_pressure || null,
                hold_time: parsedData.metadata.hold_time || null,
                empty_weight: rec.empty_weight,
                water_capacity: rec.water_capacity,
                conclusion: rec.conclusion
            }));

            // Supabase upsert requires specifying the conflicting column
            const { error: upsertError } = await supabase
                .from('cylinder_qc_records')
                .upsert(payload, { onConflict: 'serial_number' });

            if (upsertError) {
                // Check if the table doesn't exist yet
                if (upsertError.code === '42P01') {
                    throw new Error("Bảng cylinder_qc_records chưa được tạo trên Database. Vui lòng chạy script SQL tạo bảng trước.");
                }
                throw upsertError;
            }

            if (onSuccess) onSuccess(payload.length);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Có lỗi xảy ra khi lưu dữ liệu lên server.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Import QC Data (Kiểm định)</h2>
                            <p className="text-sm font-medium text-slate-500">Cập nhật thông số từ file Excel nhà máy</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    {!parsedData && (
                        <div
                            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:bg-slate-50 hover:border-emerald-400 transition-colors cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            {isParsing ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                                    <p className="font-bold text-slate-600">Đang đọc file...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <UploadCloud className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-700 mb-1">Click để tải file lên</h3>
                                    <p className="text-sm text-slate-400 font-medium">Hỗ trợ định dạng .xlsx, .xls, .csv</p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-rose-800">Lỗi</h4>
                                <p className="text-sm text-rose-600 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {parsedData && !error && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                            {/* Metadata Overview */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Đọc file thành công
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Số lượng bình</p>
                                        <p className="font-black text-emerald-600 text-lg">{parsedData.records.length}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lô (Batch)</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.batch_no || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Loại Sản phẩm</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.product_type || '—'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chất liệu</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.material || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tiêu chuẩn</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.standard || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Áp suất Test</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.test_pressure || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">T.Gian giữ áp</p>
                                        <p className="font-black text-slate-700">{parsedData.metadata.hold_time || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Records Preview Table */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Xem trước dữ liệu ({Math.min(parsedData.records.length, 5)} dòng đầu)</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-5 py-3 text-left text-xs font-black text-slate-500 uppercase">Mã Bình (Serial)</th>
                                                <th className="px-5 py-3 text-right text-xs font-black text-slate-500 uppercase">Trọng lượng (kg)</th>
                                                <th className="px-5 py-3 text-right text-xs font-black text-slate-500 uppercase">Thể tích (L)</th>
                                                <th className="px-5 py-3 text-center text-xs font-black text-slate-500 uppercase">Kết luận</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {parsedData.records.slice(0, 5).map((rec, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3 font-bold text-slate-800 text-sm">{rec.serial_number}</td>
                                                    <td className="px-5 py-3 text-right font-medium text-slate-600 text-sm">{rec.empty_weight}</td>
                                                    <td className="px-5 py-3 text-right font-medium text-slate-600 text-sm">{rec.water_capacity}</td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded text-xs font-black">
                                                            {rec.conclusion}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
                    <button
                        onClick={() => {
                            setParsedData(null);
                            setFile(null);
                            setError(null);
                        }}
                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        {parsedData ? 'Chọn file khác' : 'Hủy bỏ'}
                    </button>
                    {parsedData && (
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang cập nhật...</>
                            ) : (
                                <><UploadCloud className="w-4 h-4" /> Cập nhật {parsedData.records.length} bình</>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
