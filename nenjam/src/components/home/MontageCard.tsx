import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Film, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'
import { downloadEncryptedPhoto } from '../../lib/r2'
import { decryptBinary } from '../../lib/encryption'
import { uint8ArrayToObjectUrl, revokeObjectUrl } from '../../lib/imageProcessing'
import { format, getMonth, getYear } from 'date-fns'
import MontagePlayer from '../montage/MontagePlayer'
import type { Photo } from '../../types'

export default function MontageCard() {
  const { user, partner } = useAuthStore()
  const { sharedKey } = useEncryptionStore()
  const [pastPhotos, setPastPhotos] = useState<Photo[]>([])
  const [showMontage, setShowMontage] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user || !partner) return
    const now = new Date()
    const currentMonth = getMonth(now) + 1  // 1-based
    const currentYear = getYear(now)

    const check = async () => {
      // Find photos from same calendar month in previous years
      const { data } = await supabase
        .from('photos')
        .select('*')
        .or(`uploader_id.eq.${user.id},uploader_id.eq.${partner.id}`)
        .not('taken_at', 'is', null)

      const memories = (data ?? []).filter((p: Photo) => {
        if (!p.taken_at) return false
        const d = new Date(p.taken_at)
        return getMonth(d) + 1 === currentMonth && getYear(d) < currentYear
      })
      setPastPhotos(memories)
      setChecked(true)
    }
    check()
  }, [user, partner])

  if (!checked || pastPhotos.length === 0) return null

  const monthName = format(new Date(), 'MMMM')
  const years = [...new Set(pastPhotos.map((p) => getYear(new Date(p.taken_at!))))]

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-4 bg-gradient-to-br from-plum-50 to-rose-50 dark:from-plum-900/20 dark:to-rose-900/10 border-plum-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-plum-500 rounded-2xl flex items-center justify-center flex-none">
            <Film size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              A memory from last {monthName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {pastPhotos.length} photo{pastPhotos.length > 1 ? 's' : ''} from {years.join(', ')} are waiting ✨
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowMontage(true)}
            className="w-10 h-10 bg-plum-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-plum-200"
          >
            <Play size={16} fill="white" />
          </motion.button>
        </div>
      </motion.div>

      {showMontage && (
        <MontagePlayer
          photos={pastPhotos}
          sharedKey={sharedKey}
          onClose={() => setShowMontage(false)}
        />
      )}
    </>
  )
}
