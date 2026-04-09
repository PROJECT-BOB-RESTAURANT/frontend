import { useEffect, useState } from 'react'
import { ReadyOrderNotifications } from './components/Auth/ReadyOrderNotifications'
import { UserStatusBadge } from './components/Auth/UserStatusBadge'
import { GuestReservationPage } from './components/Guest/GuestReservationPage'
import { RestaurantGoodsManager } from './components/Management/RestaurantGoodsManager'
import { WaiterPanel } from './components/Waiter/WaiterPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppController } from './hooks/useAppController'
import { AdminHomePage } from './pages/AdminHomePage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { EditorPage } from './pages/EditorPage'
import { FloorManagementPage } from './pages/FloorManagementPage'
import { LoginPage } from './pages/LoginPage'
import { KitchenPage } from './pages/KitchenPage'
import { ReservationStatisticsPage } from './pages/ReservationStatisticsPage'
import { RestaurantManagementPage } from './pages/RestaurantManagementPage'
import { WorkersManagementPage } from './pages/WorkersManagementPage'
import { backendApi } from './services/backendApi'
import { useFloorStore } from './store/useFloorStore'

function AppContent({ role }) {
  const controller = useAppController(role)
  const [managementView, setManagementView] = useState('floors')
  const isStaff = role === 'STAFF'

  useKeyboardShortcuts()

  useEffect(() => {
    if (controller.page !== 'management') {
      setManagementView('floors')
    }
  }, [controller.page])

  if (controller.page === 'restaurant-management') {
    return (
      <RestaurantManagementPage
        role={role}
        restaurants={controller.restaurants}
        isBackendLoading={controller.isBackendLoading}
        onOpenGuestReservationPage={controller.openGuestReservationPage}
        onOpenKitchenMenu={controller.openKitchenForRestaurant}
        onOpenReservationStatistics={controller.openReservationStatisticsForRestaurant}
        onCreateRestaurant={controller.createRestaurant}
        onOpenRestaurant={controller.openRestaurant}
        onRenameRestaurant={controller.renameRestaurant}
        onDeleteRestaurant={controller.deleteRestaurant}
      />
    )
  }

  if (controller.page === 'management') {
    if (!isStaff && managementView === 'workers') {
      return (
        <WorkersManagementPage
          currentRestaurant={controller.currentRestaurant}
          currentRestaurantId={controller.currentRestaurantId}
          restaurants={controller.restaurants}
          onSwitchRestaurant={controller.switchRestaurantInManagement}
          onBack={() => setManagementView('floors')}
          onReload={controller.reloadFromBackend}
        />
      )
    }

    return (
      <FloorManagementPage
        role={role}
        currentRestaurant={controller.currentRestaurant}
        currentRestaurantId={controller.currentRestaurantId}
        restaurants={controller.restaurants}
        floors={controller.floors}
        isBackendLoading={controller.isBackendLoading}
        onBackToRestaurants={controller.backToRestaurants}
        onCreateFloor={controller.createFloor}
        onSwitchRestaurant={controller.switchRestaurantInManagement}
        onOpenFloor={controller.openFloor}
        onRenameFloor={controller.renameFloor}
        onDeleteFloor={controller.deleteFloor}
        onOpenWorkers={() => setManagementView('workers')}
        goodsManager={!isStaff ? <RestaurantGoodsManager /> : null}
      />
    )
  }

  if (controller.page === 'waiter-management') {
    return <WaiterPanel />
  }

  if (controller.page === 'kitchen-management') {
    return <KitchenPage />
  }

  if (controller.page === 'reservation-statistics') {
    return (
      <ReservationStatisticsPage
        role={role}
        currentRestaurant={controller.currentRestaurant}
        currentRestaurantId={controller.currentRestaurantId}
        restaurants={controller.restaurants}
        onSwitchRestaurant={controller.switchRestaurantInReservationStatistics}
        onBackToRestaurants={controller.backToRestaurants}
      />
    )
  }

  if (controller.page === 'guest-reservation') {
    return <GuestReservationPage />
  }

  return (
    <EditorPage
      role={role}
      onDragEnd={controller.onDragEnd}
      editorMode={controller.editorMode}
      isBackendLoading={controller.isBackendLoading}
      backendFeedback={controller.backendFeedback}
      currentRestaurantId={controller.currentRestaurantId}
      restaurants={controller.restaurants}
      currentFloorId={controller.currentFloorId}
      floors={controller.floors}
      onBackToManagement={controller.backToManagement}
      onBackToRestaurants={controller.backToRestaurants}
      onSwitchRestaurantInEditor={controller.switchRestaurantInEditor}
      onSwitchFloorInEditor={controller.switchFloorInEditor}
      onSaveCurrentFloorLayout={controller.onSaveCurrentFloorLayout}
      onSetEditorMode={controller.setEditorMode}
    />
  )
}

function App() {
  const [session, setSession] = useState(() => backendApi.getAuthSession())
  const [adminView, setAdminView] = useState(() =>
    backendApi.getAuthSession()?.role === 'ADMIN' ? 'home' : 'restaurants',
  )
  const currentRestaurantId = useFloorStore((state) => state.currentRestaurantId)
  const restaurants = useFloorStore((state) => state.restaurants)

  const onAuthenticated = (nextSession) => {
    setSession(nextSession)
    setAdminView(nextSession?.role === 'ADMIN' ? 'home' : 'restaurants')
  }

  const logout = () => {
    backendApi.clearAuthSession()
    setSession(null)
    setAdminView('restaurants')
  }

  if (!session) {
    return <LoginPage onAuthenticated={onAuthenticated} />
  }

  if (session.role === 'ADMIN' && adminView === 'home') {
    return (
      <>
        <ReadyOrderNotifications
          session={session}
          role={session.role}
          currentRestaurantId={currentRestaurantId}
          restaurants={restaurants}
        />
        <UserStatusBadge session={session} onLogout={logout} />
        <AdminHomePage
          onManageUsers={() => setAdminView('users')}
          onManageRestaurants={() => setAdminView('restaurants')}
        />
      </>
    )
  }

  if (session.role === 'ADMIN' && adminView === 'users') {
    return (
      <>
        <ReadyOrderNotifications
          session={session}
          role={session.role}
          currentRestaurantId={currentRestaurantId}
          restaurants={restaurants}
        />
        <UserStatusBadge session={session} onLogout={logout} />
        <AdminUsersPage onBack={() => setAdminView('home')} />
      </>
    )
  }

  return (
    <>
      <ReadyOrderNotifications
        session={session}
        role={session.role}
        currentRestaurantId={currentRestaurantId}
        restaurants={restaurants}
      />
      <UserStatusBadge
        session={session}
        onLogout={logout}
        onBackToAdmin={session.role === 'ADMIN' ? () => setAdminView('home') : undefined}
      />
      <AppContent role={session.role} />
    </>
  )
}

export default App
