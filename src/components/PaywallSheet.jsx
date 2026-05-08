import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, MessageCircle, Search } from 'lucide-react'
import { FREE_LIMITS } from '../utils/limits'

const PLANS = [
  {
    name: 'Nemokamas',
    price: '€0',
    color: 'bg-gray-50 border-gray-200',
    badge: null,
    features: [
      { icon: Search,         label: `${FREE_LIMITS.searches} AI paieška` },
      { icon: MessageCircle, label: `${FREE_LIMITS.chats} AI pokalbiai` },
    ],
  },
  {
    name: 'Starter',
    price: '€2 / mėn',
    color: 'bg-brand/5 border-brand/30',
    badge: 'Netrukus',
    features: [
      { icon: Search,         label: '20 paieškų / mėn' },
      { icon: MessageCircle, label: '30 pokalbių / mėn' },
    ],
  },
  {
    name: 'Pro',
    price: '€5 / mėn',
    color: 'bg-brand/10 border-brand/40',
    badge: 'Netrukus',
    features: [
      { icon: Search,         label: 'Neribota paieška' },
      { icon: MessageCircle, label: 'Neriboti pokalbiai' },
    ],
  },
]

const LIMIT_LABELS = {
  searches: 'AI paieška',
  chats:    'AI pokalbiai',
  fbPosts:  'FB skelbimai',
}

export default function PaywallSheet({ open, limitType, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[85dvh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-brand" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Pasiektas limitas</h2>
                  <p className="text-xs text-gray-500">
                    {LIMIT_LABELS[limitType] ?? 'AI funkcija'} — nemokamas planas
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl active:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Plans */}
            <div className="space-y-3 mb-5">
              {PLANS.map(plan => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-4 ${plan.color}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                    <div className="flex items-center gap-2">
                      {plan.badge && (
                        <span className="text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                          {plan.badge}
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-700">{plan.price}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {plan.features.map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Icon size={12} className="text-gray-400 shrink-0" />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a
              href="mailto:kestutis@okone.lt?subject=Gėlių žinynas prenumerata"
              className="block w-full py-3.5 bg-brand text-white text-sm font-semibold text-center rounded-2xl"
            >
              Susisiekti dėl prenumeratos
            </a>
            <p className="text-xs text-gray-400 text-center mt-3">
              Mokėjimai bus pridėti netrukus
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
