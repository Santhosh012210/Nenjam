import { useState, useRef } from 'react'
import { Send, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-rose-100 dark:border-gray-800 px-4 pt-3 bottom-nav">
      <div className="flex items-end gap-3">
        <div className="flex-1 bg-cream-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={disabled ? 'Waiting for partner...' : 'Message...'}
            disabled={disabled}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-sm resize-none focus:outline-none max-h-28"
            style={{ minHeight: '1.25rem' }}
          />
          <Lock size={12} className="text-rose-300 flex-none mb-0.5" />
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="w-10 h-10 bg-rose-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 rounded-2xl flex items-center justify-center flex-none transition-colors shadow-md shadow-rose-200/50"
        >
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  )
}
