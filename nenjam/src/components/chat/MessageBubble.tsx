import { motion } from 'framer-motion'
import { format } from 'date-fns'
import type { Message } from '../../types'

interface Props {
  message: Message
  isMine: boolean
}

export default function MessageBubble({ message, isMine }: Props) {
  const time = format(new Date(message.created_at), 'h:mm a')

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[78%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isMine
              ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-br-sm'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm rounded-bl-sm'
          }`}
        >
          {message.content ?? (
            <span className="opacity-60 text-xs italic">🔒 encrypted</span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
      </div>
    </motion.div>
  )
}
