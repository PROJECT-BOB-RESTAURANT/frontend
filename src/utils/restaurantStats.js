const countFolders = (folders) => {
  if (!Array.isArray(folders)) return 0
  return folders.reduce((sum, folder) => sum + 1 + countFolders(folder.folders), 0)
}

const getTodayName = () => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[new Date().getDay()]
}

const formatTodayOpeningHours = (restaurant) => {
  const today = getTodayName()
  const hours = restaurant?.openingHours ?? []
  const entry = hours.find((item) => item.day === today)
  if (!entry) return `${today}: not set`
  if (entry.isClosed) return `${today}: closed`
  return `${today}: ${entry.open} - ${entry.close}`
}

export { countFolders, formatTodayOpeningHours }
