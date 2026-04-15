function LeafIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  )
}

function BookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  )
}

function SparkleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  )
}

const tabs = [
  { id: 'dashboard',  label: 'Augalai',   Icon: LeafIcon },
  { id: 'biblioteka', label: 'Biblioteka', Icon: BookIcon },
  { id: 'zinynas',   label: 'Žinynas',   Icon: SparkleIcon },
]

export default function Navigation({ active, onChange, dashboardCount = 0 }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
      <div className="bg-white border-t border-gray-200 safe-bottom">
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="flex-1 flex flex-col items-center py-2 pt-2.5 gap-0.5 transition-colors duration-150 relative"
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-colors duration-150 ${
                    isActive ? 'text-primary' : 'text-gray-400'
                  }`} />
                  {id === 'dashboard' && dashboardCount > 0 && (
                    <div className="absolute -top-1 -right-2.5 bg-primary text-white rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                      <span className="text-[9px] font-bold leading-none">
                        {dashboardCount > 99 ? '99+' : dashboardCount}
                      </span>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-150 ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
