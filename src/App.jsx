import { GuestReservationPage } from './components/Guest/GuestReservationPage'
import { RestaurantGoodsManager } from './components/Management/RestaurantGoodsManager'
import { WaiterPanel } from './components/Waiter/WaiterPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppController } from './hooks/useAppController'
import { EditorPage } from './pages/EditorPage'
import { FloorManagementPage } from './pages/FloorManagementPage'
import { RestaurantManagementPage } from './pages/RestaurantManagementPage'

function App() {
  const controller = useAppController()

  useKeyboardShortcuts()

  if (controller.page === 'restaurant-management') {
    return (
      <RestaurantManagementPage
        restaurants={controller.restaurants}
        isBackendLoading={controller.isBackendLoading}
        onOpenGuestReservationPage={controller.openGuestReservationPage}
        onCreateRestaurant={controller.createRestaurant}
        onOpenRestaurant={controller.openRestaurant}
        onRenameRestaurant={controller.renameRestaurant}
        onDeleteRestaurant={controller.deleteRestaurant}
      />
    )
  }

  if (controller.page === 'management') {
    return (
      <FloorManagementPage
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
        goodsManager={<RestaurantGoodsManager />}
      />
    )
  }

  if (controller.page === 'waiter-management') {
    return <WaiterPanel />
  }

  if (controller.page === 'guest-reservation') {
    return <GuestReservationPage />
  }

  return (
    <EditorPage
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

export default App
