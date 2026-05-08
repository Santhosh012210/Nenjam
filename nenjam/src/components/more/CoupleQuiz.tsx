import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, HelpCircle, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { QuizQuestion, QuizAnswer } from '../../types'
import { DEFAULT_QUIZ_QUESTIONS } from '../../types'
import { format } from 'date-fns'

export default function CoupleQuiz() {
  const navigate = useNavigate()
  const { user, partner } = useAuthStore()
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [myAnswer, setMyAnswer] = useState<QuizAnswer | null>(null)
  const [partnerAnswer, setPartnerAnswer] = useState<QuizAnswer | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!user || !partner) return
    const load = async () => {
      // Seed questions if none exist
      const { data: existing } = await supabase.from('quiz_questions').select('id').limit(1)
      if (!existing || existing.length === 0) {
        for (const q of DEFAULT_QUIZ_QUESTIONS) {
          await supabase.from('quiz_questions').insert({ question: q })
        }
      }

      // Pick today's question deterministically by day-of-year index
      const { data: questions } = await supabase.from('quiz_questions').select('*').order('id')
      if (!questions?.length) return
      const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
      const q = questions[dayOfYear % questions.length]
      setQuestion(q)

      // Load answers for today
      const { data: answers } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('question_id', q.id)
        .eq('quiz_date', today)
        .in('user_id', [user.id, partner.id])

      setMyAnswer(answers?.find((a) => a.user_id === user.id) ?? null)
      setPartnerAnswer(answers?.find((a) => a.user_id === partner.id) ?? null)
    }
    load()
  }, [user, partner, today])

  const submit = async () => {
    if (!answerText.trim() || !question || !user) return
    setSaving(true)
    const { data } = await supabase
      .from('quiz_answers')
      .upsert({ question_id: question.id, user_id: user.id, answer: answerText.trim(), quiz_date: today })
      .select()
      .single()
    setMyAnswer(data)
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/more')} className="text-gray-400 p-1"><ArrowLeft size={22} /></button>
          <h1 className="flex-1 text-xl font-bold text-gray-900 dark:text-white">Couple Quiz</h1>
        </div>

        <div className="card p-5 mb-5 text-center">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={28} className="text-indigo-500" />
          </div>
          <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium mb-2">Today's question</p>
          {question ? (
            <p className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">
              {question.question}
            </p>
          ) : (
            <p className="text-gray-400">Loading...</p>
          )}
        </div>

        {/* My answer */}
        {!myAnswer ? (
          <div className="card p-4 space-y-3">
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Your answer..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <button onClick={submit} disabled={saving || !answerText.trim()} className="btn-primary w-full text-sm py-2.5">
              {saving ? '...' : 'Submit my answer'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Your answer</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3">
                {myAnswer.answer}
              </p>
            </div>

            {partnerAnswer ? (
              <>
                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className="btn-primary w-full"
                  >
                    Reveal {partner?.display_name?.split(' ')[0]}'s answer 🎉
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-4"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      {partner?.display_name?.split(' ')[0]}'s answer
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-pink-50 dark:bg-pink-900/20 rounded-xl p-3">
                      {partnerAnswer.answer}
                    </p>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="text-center text-sm text-gray-400 py-4">
                Waiting for {partner?.display_name?.split(' ')[0]}'s answer... 💕
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
