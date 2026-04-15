import PlantCard from '../components/PlantCard'

export default function History({ plants, onTap, onImageFetch }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Augalų istorija</p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Istorija<br />ir pamokos 📖</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-bold text-gray-400">{plants.length}</span>
            <span className="text-xs text-gray-400">augal{plants.length === 1 ? 'as' : 'ai'}</span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      {plants.length > 0 && (
        <div className="px-5 mb-4">
          <div className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="text-sm">📚</span>
            <p className="text-xs text-gray-500">
              Susirinktos <span className="font-semibold text-gray-700">{plants.length}</span> pamokos augalo priežiūroje
            </p>
          </div>
        </div>
      )}

      {/* 2-column grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-6xl">📖</div>
            <div>
              <p className="text-base font-semibold text-gray-700">Istorija tuščia</p>
              <p className="text-sm text-gray-400 mt-1">
                Čia atsiras augalai, kuriems nepasisekė.<br />
                Kiekvienas – pamoka ateičiai.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {plants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                section="history"
                onTap={() => onTap(plant)}
                onImageFetch={onImageFetch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
