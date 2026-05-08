import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useEncryptionStore } from '../stores/encryptionStore'
import { encryptShared, decryptShared } from '../lib/encryption'
import type { Message } from '../types'
import MessageBubble from '../components/chat/MessageBubble'
import ChatInput from '../components/chat/ChatInput'
import { format } from 'date-fns'

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, profile, partner } = useAuthStore()
  const { sharedKey } = useEncryptionStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const decrypt = useCallback(
    (msg: Message): Message => {
      if (!sharedKey) return msg
      const content = decryptShared(msg.encrypted_content, msg.nonce, sharedKey) ?? '🔒 [encrypted]'
      return { ...msg, content }
    },
    [sharedKey]
  )

  // Load history
  useEffect(() => {
    if (!user || !partner) return
    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
        .limit(100)

      setMessages((data ?? []).map(decrypt))
      setLoading(false)
    }
    load()
  }, [user, partner, decrypt])

  // Real-time subscription
  useEffect(() => {
    if (!user || !partner) return
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = decrypt(payload.new as Message)
          setMessages((prev) => [...prev, msg])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, partner, decrypt])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sharedKey || !user || !partner) return
    const { encrypted, nonce } = encryptShared(text.trim(), sharedKey)

    // Optimistic update
    const optimistic: Message = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      recipient_id: partner.id,
      encrypted_content: encrypted,
      nonce,
      content: text.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: partner.id,
      encrypted_content: encrypted,
      nonce,
    })
  }

  // Group messages by date
  const grouped = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const d = format(new Date(msg.created_at), 'MMMM d, yyyy')
    const last = acc[acc.length - 1]
    if (last?.date === d) last.msgs.push(msg)
    else acc.push({ date: d, msgs: [msg] })
    return acc
  }, [])

  return (
    <div className="flex flex-col h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-rose-100 dark:border-gray-800">
        <button onClick={() => navigate('/')} className="p-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900 dark:text-white">
            {partner?.display_name ?? 'Chat'}
          </h1>
          <div className="flex items-center gap-1">
            <Lock size={10} className="text-rose-400" />
            <span className="text-xs text-rose-400">End-to-end encrypted</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
          </div>
        )}

        {!sharedKey && !loading && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Lock size={32} className="mx-auto mb-2 text-rose-300" />
            <p>Waiting for partner's public key to decrypt messages.</p>
            <p className="text-xs mt-1">Ask your partner to open the app first.</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.date}>
            <div className="text-center my-4">
              <span className="text-xs text-gray-400 bg-cream-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                {group.date}
              </span>
            </div>
            <AnimatePresence>
              {group.msgs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.sender_id === user?.id}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={!sharedKey} />
    </div>
  )
}
