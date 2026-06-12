import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import TableScene, { GAME_WIDTH, GAME_HEIGHT } from './TableScene';

function PhaserGame() {
  const hostRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) {
      return undefined;
    }

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#0a141f',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [TableScene]
    });

    // Phaser only re-fits on window resize; the host also shrinks when the
    // hand dock mounts below the table, so watch the host element directly.
    const observer = new ResizeObserver(() => {
      gameRef.current?.scale.refresh();
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="phaser-host" />;
}

export default PhaserGame;
