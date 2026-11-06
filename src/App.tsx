import { useGameStore } from './store/useGameStore';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameBoard } from './components/GameBoard';

export function App() {
  const { clientState } = useGameStore();

  if (!clientState) {
    return <HomeScreen />;
  }

  if (clientState.phase === 'LOBBY') {
    return <LobbyScreen />;
  }

  return <GameBoard />;
}

export default App;
