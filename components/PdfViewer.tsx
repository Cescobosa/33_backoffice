'use client'
export default function PdfViewer({ url }: { url: string }) {
  return (
    <div className="w-full h-[70vh] bg-gray-100 rounded-md overflow-hidden">
      <iframe src={`${url}#toolbar=1`} className="w-full h-full" />
    </div>
  )
}
