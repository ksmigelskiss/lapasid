import PlantCard from '../components/PlantCard'

export default function Wishlist({ plants, onTap, onImageFetch, onSearch }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-blush-500 uppercase tracking-widest mb-1">Norų sąrašas</p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Noriu<br />įsigyti ✨</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-bold text-blush-400">{plants.length}</span>
            <span className="text-xs text-gray-400">augal{plants.length === 1 ? 'as' : 'ai'}</span>
          </div>
        </div>
      </div>

      {/* Search button */}
      <div className="px-5 mb-4">
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-3 bg-blush-50 hover:bg-blush-100 transition-colors rounded-2xl px-4 py-3"
        >
          <span className="text-blush-300">🔍</span>
          <span className="text-sm text-blush-300">Rasti ir pridėti augalą...</span>
        </button>
      </div>

      {/* 2-column grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-6xl">✨</div>
            <div>
              <p className="text-base font-semibold text-gray-700">Norų sąrašas tuščias</p>
              <p className="text-sm text-gray-400 mt-1">Ieškokite augalų ir pridėkite</p>
            </div>
            <button
              onClick={onSearch}
              className="mt-2 px-6 py-3 bg-blush-400 text-white rounded-2xl text-sm font-medium"
            >
              + Pridėti augalą
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {plants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                section="wishlist"
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
