import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticleField() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!init) return null;

  return (
    <Particles
      id="tsparticles"
      options={{
        background: {
          color: {
            value: "transparent",
          },
        },
        fpsLimit: 30,
        interactivity: {
          events: {
            onHover: {
              enable: false,
            },
          },
        },
        particles: {
          color: {
            value: "#00d4ff",
          },
          links: {
            color: "#00d4ff",
            distance: 140,
            enable: true,
            opacity: 0.05,
            width: 0.5,
          },
          move: {
            direction: "none",
            enable: true,
            outModes: {
              default: "out",
            },
            random: true,
            speed: 0.25,
            straight: false,
          },
          number: {
            density: {
              enable: true,
              area: 1200,
            },
            value: 35,
          },
          opacity: {
            value: { min: 0.03, max: 0.15 },
          },
          shape: {
            type: "circle",
          },
          size: {
            value: { min: 1, max: 1.5 },
          },
        },
        detectRetina: true,
      }}
      className="absolute inset-0 -z-10"
    />
  );
}
