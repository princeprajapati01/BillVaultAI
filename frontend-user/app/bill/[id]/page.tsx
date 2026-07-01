'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Trash2, 
  Edit3,
  CheckCircle2,
  FileText,
  DollarSign,
  Calendar,
  Hash,
  Receipt,
  Building2,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
  CreditCard,
  Tag
} from 'lucide-react'

function formatCurrency(amount: number | undefined | null, currency: string = 'INR'): string {
  const val = Number(amount ?? 0)
  if (currency === 'USD') return `$${val.toFixed(2)}`
  if (currency === 'EUR') return `€${val.toFixed(2)}`
  if (currency === 'GBP') return `£${val.toFixed(2)}`
  return `₹${val.toFixed(2)}`
}

export default function BillDetailScreen() {
  const router = useRouter()
  const params = useParams()
  const [showRawOCR, setShowRawOCR] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const [bill, setBill] = useState<any>(null)
  const [fields, setFields] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    async function loadBillDetail() {
      try {
        const id = params.id
        if (!id) return

        let url = `http://localhost:8000/api/bills/${id}`
        
        // Handle fallback for 'current'
        if (id === 'current') {
          const rawData = localStorage.getItem('processed_bill_data')
          if (rawData) {
            const parsed = JSON.parse(rawData)
            if (parsed.id) {
              url = `http://localhost:8000/api/bills/${parsed.id}`
            } else {
              setLoading(false)
              return
            }
          } else {
            setLoading(false)
            return
          }
        }

        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!res.ok) {
          throw new Error('Failed to load bill detail')
        }

        const data = await res.json()
        const currency = data.currency || 'INR'
        
        setBill({
          id: data.id,
          merchant: data.merchant,
          amount: data.amount,
          currency,
          gst: data.gst,
          cgst: data.cgst || 0.0,
          sgst: data.sgst || 0.0,
          igst: data.igst || 0.0,
          gstNumber: data.gstNumber || '',
          subtotal: data.subtotal || 0.0,
          paymentMethod: data.paymentMethod || '',
          transactionId: data.transactionId || '',
          notes: data.notes || '',
          invoiceNumber: data.invoiceNumber,
          date: data.date,
          category: data.category || 'Office',
          status: data.status || 'processed',
          confidence: data.confidence || 95,
          imageUrl: data.imageUrl,
          rawOCR: data.rawOCR || 'No raw OCR text available.',
          metadata: {
            uploadDate: data.metadata?.uploadDate || 'Recently',
            processingTime: data.metadata?.processingTime || '1.8 seconds',
            fileSize: 'Unknown',
            category: data.category || 'Office'
          }
        })

        setFields([
          { key: 'vendor_name', label: 'Vendor Name', value: data.merchant || '', confidence: data.confidence || 95, icon: Building2 },
          { key: 'invoice_number', label: 'Invoice Number', value: data.invoiceNumber || '', confidence: data.confidence || 95, icon: Hash },
          { key: 'invoice_date', label: 'Invoice Date', value: data.date || '', confidence: data.confidence || 95, icon: Calendar },
          { key: 'gst_number', label: 'GST Number', value: data.gstNumber || '', confidence: data.confidence || 95, icon: Receipt },
          { key: 'subtotal', label: 'Subtotal', value: formatCurrency(data.subtotal, currency), confidence: data.confidence || 95, icon: DollarSign },
          { key: 'cgst_amount', label: 'CGST', value: formatCurrency(data.cgst, currency), confidence: data.confidence || 95, icon: Receipt },
          { key: 'sgst_amount', label: 'SGST', value: formatCurrency(data.sgst, currency), confidence: data.confidence || 95, icon: Receipt },
          { key: 'igst_amount', label: 'IGST', value: formatCurrency(data.igst, currency), confidence: data.confidence || 95, icon: Receipt },
          { key: 'tax_amount', label: 'Tax Amount', value: formatCurrency(data.gst, currency), confidence: data.confidence || 95, icon: Receipt },
          { key: 'invoice_total', label: 'Total Amount', value: formatCurrency(data.amount, currency), confidence: data.confidence || 95, icon: DollarSign },
          { key: 'due_date', label: 'Due Date (dd/mm/yyyy)', value: data.dueDate || '', confidence: data.confidence || 95, icon: Calendar },
          { key: 'payment_terms', label: 'Payment Terms', value: data.paymentTerms || '', confidence: data.confidence || 95, icon: FileText },
          { key: 'balance_due', label: 'Balance Due', value: formatCurrency(data.balanceDue, currency), confidence: data.confidence || 95, icon: DollarSign },
          { key: 'amount_paid', label: 'Amount Paid', value: formatCurrency(data.amountPaid, currency), confidence: data.confidence || 95, icon: DollarSign },
          { key: 'payment_status', label: 'Payment Status', value: data.paymentStatus || 'UNKNOWN', confidence: data.confidence || 95, icon: CheckCircle2 },
          { key: 'status_reason', label: 'Status Reason', value: data.statusReason || '', confidence: data.confidence || 95, icon: FileText },
          { key: 'payment_method', label: 'Payment Method', value: data.paymentMethod || 'Not detected', confidence: data.confidence || 95, icon: CreditCard },
          { key: 'transaction_id', label: 'Transaction ID', value: data.transactionId || '', confidence: data.confidence || 95, icon: Hash },
          { key: 'category', label: 'Expense Category', value: data.category || 'Office', confidence: data.confidence || 95, icon: Tag },
          { key: 'notes', label: 'Notes', value: data.notes || '', confidence: data.confidence || 95, icon: FileText }
        ])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadBillDetail()
  }, [params.id, router])

  const handleFieldChange = (index: number, newValue: string) => {
    setFields(prev => {
      const updated = [...prev]
      updated[index].value = newValue
      return updated
    })
  }

  const handleSave = async () => {
    setIsEditing(false)
    const token = localStorage.getItem('auth_token')
    if (!token || !bill) return

    // Extract values from fields list
    const updatedData: any = {}
    fields.forEach(f => {
      if (f.key === 'vendor_name') updatedData.merchant_name = f.value
      if (f.key === 'invoice_number') updatedData.invoice_number = f.value
      if (f.key === 'invoice_date') updatedData.invoice_date = f.value
      if (f.key === 'gst_number') updatedData.gst_number = f.value
      if (f.key === 'subtotal') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.subtotal = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'cgst_amount') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.cgst_amount = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'sgst_amount') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.sgst_amount = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'igst_amount') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.igst_amount = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'tax_amount') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.tax_amount = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'invoice_total') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.invoice_total = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'due_date') updatedData.due_date = f.value
      if (f.key === 'payment_terms') updatedData.payment_terms = f.value
      if (f.key === 'balance_due') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.balance_due = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'amount_paid') {
        const val = parseFloat(f.value.replace(/[^0-9.]/g, ''))
        updatedData.amount_paid = isNaN(val) ? 0.0 : val
      }
      if (f.key === 'payment_status') updatedData.payment_status = f.value
      if (f.key === 'status_reason') updatedData.status_reason = f.value
      if (f.key === 'payment_method') updatedData.payment_method = f.value
      if (f.key === 'transaction_id') updatedData.transaction_id = f.value
      if (f.key === 'category') updatedData.category = f.value
      if (f.key === 'notes') updatedData.notes = f.value
    })

    try {
      const res = await fetch(`http://localhost:8000/api/bills/${bill.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
      })
      if (!res.ok) {
        throw new Error('Failed to update bill')
      }
      
      // Update local state
      setBill((prev: any) => ({
        ...prev,
        merchant: updatedData.merchant_name,
        amount: updatedData.invoice_total,
        gst: updatedData.tax_amount,
        cgst: updatedData.cgst_amount,
        sgst: updatedData.sgst_amount,
        igst: updatedData.igst_amount,
        gstNumber: updatedData.gst_number,
        subtotal: updatedData.subtotal,
        dueDate: updatedData.due_date,
        paymentTerms: updatedData.payment_terms,
        balanceDue: updatedData.balance_due,
        amountPaid: updatedData.amount_paid,
        paymentStatus: updatedData.payment_status,
        statusReason: updatedData.status_reason,
        paymentMethod: updatedData.payment_method,
        transactionId: updatedData.transaction_id,
        notes: updatedData.notes,
        invoiceNumber: updatedData.invoice_number,
        date: updatedData.invoice_date,
        category: updatedData.category
      }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return
    
    const token = localStorage.getItem('auth_token')
    if (!token || !bill) return

    try {
      const res = await fetch(`http://localhost:8000/api/bills/${bill.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        // Clear local storage variables
        localStorage.removeItem('processed_bill_data')
        localStorage.removeItem('temp_bill_file')
        localStorage.removeItem('temp_bill_name')
        localStorage.removeItem('temp_bill_size')
        router.push('/dashboard')
      } else {
        alert('Failed to delete invoice.')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const generateFormCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Helpers
    const drawText = (text: string, x: number, y: number, fontSize: number, isBold = false, align = 'left') => {
      ctx.fillStyle = '#000000';
      ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px Arial, sans-serif`;
      ctx.textAlign = align as CanvasTextAlign;
      ctx.fillText(text, x, y);
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Header Title
    drawText('Invoice Entry Form Template', canvas.width / 2, 120, 36, true, 'center');

    const getVal = (key: string) => {
      const field = fields.find(f => f.key === key);
      return field ? field.value : '';
    };

    const startX = 150;
    const endX = 1090;
    let y = 260;
    const rowHeight = 70;

    const drawTemplateField = (label: string, value: string) => {
      drawText(label, startX, y, 22, true);
      ctx.font = 'bold 22px Arial, sans-serif';
      const labelWidth = ctx.measureText(label).width;
      const lineStartX = startX + labelWidth + 15;
      
      drawLine(lineStartX, y + 5, endX, y + 5, 1.5);
      if (value) {
        drawText(value, lineStartX + 10, y - 2, 22, false);
      }
      y += rowHeight;
    };

    // Group 1: General Info
    drawTemplateField('Vendor Name:', getVal('vendor_name'));
    drawTemplateField('Invoice Number:', getVal('invoice_number'));
    drawTemplateField('Invoice Date:', getVal('invoice_date'));
    drawTemplateField('GST Number:', getVal('gst_number'));

    y += 30;

    // Group 2: Financials
    drawTemplateField('Subtotal:', getVal('subtotal'));
    drawTemplateField('CGST:', getVal('cgst_amount'));
    drawTemplateField('SGST:', getVal('sgst_amount'));
    drawTemplateField('IGST:', getVal('igst_amount'));
    drawTemplateField('Tax Amount:', getVal('tax_amount'));
    drawTemplateField('Total Amount:', getVal('invoice_total'));

    y += 30;

    // Group 3: Payment Tracking
    drawTemplateField('Due Date:', getVal('due_date'));
    drawTemplateField('Payment Terms:', getVal('payment_terms'));
    drawTemplateField('Balance Due:', getVal('balance_due'));
    drawTemplateField('Amount Paid:', getVal('amount_paid'));
    drawTemplateField('Payment Status:', getVal('payment_status'));
    drawTemplateField('Status Reason:', getVal('status_reason'));

    y += 30;

    // Group 4: Metadata
    drawTemplateField('Payment Method:', getVal('payment_method'));
    drawTemplateField('Transaction ID:', getVal('transaction_id'));
    drawTemplateField('Expense Category:', getVal('category'));
    drawTemplateField('Notes:', getVal('notes'));

    return canvas;
  };

  const downloadPNG = () => {
    const canvas = generateFormCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `invoice_form_${bill.id || 'export'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadPDF = async () => {
    const canvas = generateFormCanvas();
    if (!canvas) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 595.28, 841.89);
    pdf.save(`invoice_form_${bill.id || 'export'}.pdf`);
  };

  useEffect(() => {
    if (!loading && bill) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('download') === 'true') {
        downloadPDF();
      }
    }
  }, [loading, bill]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-2">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading invoice detail...</span>
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 max-w-sm w-full">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Bill Data Found</h2>
          <p className="text-gray-600 mb-6">Please upload a bill first to view details.</p>
          <button
            onClick={() => router.push('/upload')}
            className="w-full py-3 bg-gradient-emerald text-white font-bold rounded-xl shadow-lg hover:shadow-glow transition-all"
          >
            Go to Upload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-none">
                  {bill.merchant}
                </h1>
                <p className="text-xs text-gray-600">ID: {bill.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleSave()
                  } else {
                    setIsEditing(true)
                  }
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                  isEditing 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-glow' 
                    : 'bg-primary-50 hover:bg-primary-100 text-primary-600'
                }`}
              >
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Image Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
              {bill.imageUrl ? (
                <img
                  src={bill.imageUrl}
                  alt="Bill attachment"
                  className="max-h-[450px] object-contain rounded-xl w-full"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No image attachment uploaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Extracted Fields & Metadata */}
          <div className="space-y-6">
            {/* Extracted Fields Card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Extracted Fields
              </h3>

              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                {fields.map((field, index) => (
                  <div key={field.key} className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary-600 shadow-sm flex-shrink-0">
                      <field.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 font-medium">{field.label}</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleFieldChange(index, e.target.value)}
                          className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm font-semibold text-gray-950"
                        />
                      ) : (
                        <p className="text-sm font-bold text-gray-900 break-words whitespace-pre-wrap mt-0.5">
                          {field.value}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">
                      <Zap className="w-3 h-3" />
                      {field.confidence}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={downloadPDF}
                className="py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF Form
              </button>
              <button 
                onClick={downloadPNG}
                className="py-3 px-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Download Image Form
              </button>
            </div>

            {/* Metadata Accordion */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="w-full p-6 flex items-center justify-between text-left font-bold text-gray-900 hover:bg-gray-50 transition-all"
              >
                <span>Processing Metadata</span>
                {showMetadata ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
              {showMetadata && (
                <div className="px-6 pb-6 pt-2 divide-y divide-gray-100 border-t border-gray-50 text-sm text-gray-600">
                  <div className="py-2.5 flex justify-between">
                    <span>Upload Date</span>
                    <span className="font-semibold text-gray-900">{bill.metadata.uploadDate}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span>AI Processing Duration</span>
                    <span className="font-semibold text-gray-900">{bill.metadata.processingTime}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span>File Size</span>
                    <span className="font-semibold text-gray-900">{bill.metadata.fileSize}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span>Estimated Confidence</span>
                    <span className="font-semibold text-emerald-600 font-bold">{bill.confidence}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Raw OCR Accordion */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowRawOCR(!showRawOCR)}
                className="w-full p-6 flex items-center justify-between text-left font-bold text-gray-900 hover:bg-gray-50 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary-500" />
                  View Raw OCR Text
                </span>
                {showRawOCR ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
              {showRawOCR && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-50">
                  <pre className="bg-gray-50 p-4 rounded-xl text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {bill.rawOCR}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
