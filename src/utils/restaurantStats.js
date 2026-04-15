const countFolders = (folders) => {
  if (!Array.isArray(folders)) return 0
  return folders.reduce((sum, folder) => sum + 1 + countFolders(folder.folders), 0)
}

const getTodayName = () => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[new Date().getDay()]
}

const getTodayDateKey = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatTodayOpeningHours = (restaurant) => {
  const todayDate = getTodayDateKey()
  const overrides = Array.isArray(restaurant?.openingDateOverrides)
    ? restaurant.openingDateOverrides
    : []
  const override = overrides.find((item) => item.date === todayDate)

  const today = getTodayName()
  if (override) {
    if (override.isClosed) return `${today}: closed (special date)`
    return `${today}: ${override.open} - ${override.close} (special date)`
  }

  const hours = restaurant?.openingHours ?? []
  const entry = hours.find((item) => item.day === today)
  if (!entry) return `${today}: not set`
  if (entry.isClosed) return `${today}: closed`
  return `${today}: ${entry.open} - ${entry.close}`
}

export { countFolders, formatTodayOpeningHours }
