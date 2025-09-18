// ESTE CÓDIGO É PARA SER EXECUTADO EM UM PROJETO REAL COM EXPO E NÃO SERÁ COMPILADO NESTE AMBIENTE ONLINE.
// O ERRO DE COMPILAÇÃO "Could not resolve" É ESPERADO AQUI.
// Para usar este código, você deve ter um projeto Expo configurado em sua máquina e instalar as bibliotecas
// usando os comandos `npx expo install ...` conforme solicitado na sua requisição original.
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Easing, SafeAreaView, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

const referencePoint = {
  latitude: -23.11443,
  longitude: -45.70780,
};

const SOUND_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const MAX_DISTANCE_METERS = 60; // Raio máximo para o tesouro

// Funções de utilidade para cálculos geográficos
const toRad = (value) => (value * Math.PI) / 180;
const toDeg = (value) => (value * 180) / Math.PI;

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Raio da Terra em metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distância em metros
};

const calculateBearing = (startLat, startLon, endLat, endLon) => {
  startLat = toRad(startLat);
  startLon = toRad(startLon);
  endLat = toRad(endLat);
  endLon = toRad(endLon);

  const y = Math.sin(endLon - startLon) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLon - startLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  
  // Normaliza o ângulo para 0-360 graus
  if (bearing < 0) {
    bearing += 360;
  }
  return bearing;
};

const animateValue = (ref, toValue) => {
  Animated.timing(ref, {
    toValue,
    duration: 500,
    easing: Easing.linear,
    useNativeDriver: false,
  }).start();
};

const generateRandomTreasure = (center, maxDistance) => {
  const R_EARTH = 6371e3; // Raio da Terra em metros
  const latRad = toRad(center.latitude);
  const lonRad = toRad(center.longitude);

  // Gere uma distância e ângulo aleatórios
  const randomDistance = Math.random() * maxDistance;
  const randomAngle = Math.random() * 2 * Math.PI;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(randomDistance / R_EARTH) +
    Math.cos(latRad) * Math.sin(randomDistance / R_EARTH) * Math.cos(randomAngle)
  );

  const newLonRad = lonRad + Math.atan2(
    Math.sin(randomAngle) * Math.sin(randomDistance / R_EARTH) * Math.cos(latRad),
    Math.cos(randomDistance / R_EARTH) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    latitude: toDeg(newLatRad),
    longitude: toDeg(newLonRad),
  };
};

export default function App() {
  // Estados do aplicativo
  const [location, setLocation] = useState(null);
  const [treasureLocation, setTreasureLocation] = useState(null);
  const [hint, setHint] = useState("Procurando sua localização...");
  const [distanceSteps, setDistanceSteps] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isTreasureFound, setIsTreasureFound] = useState(false);
  const [soundObject, setSoundObject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Valores animados
  const animatedBackgroundColorRef = useRef(new Animated.Value(0));
  const animatedRotationRef = useRef(new Animated.Value(0));
  const animatedPulseRef = useRef(new Animated.Value(0));

  // Lógica principal do jogo
  useEffect(() => {
    (async () => {
      // 1. Gerar a localização do tesouro
      setTreasureLocation(generateRandomTreasure(referencePoint, MAX_DISTANCE_METERS));

      // 2. Solicitar permissão de localização
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHint('Permissão de localização negada.');
        setLoading(false);
        return;
      }

      // 3. Carregar o som e adicionar o ouvinte de status de reprodução
      const sound = new Audio.Sound();
      try {
        await sound.loadAsync({ uri: SOUND_URL });
        // Adiciona um ouvinte para redefinir o estado quando a música terminar
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            setIsMusicPlaying(false);
          }
        });
        setSoundObject(sound);
      } catch (error) {
        console.error("Erro ao carregar o som: ", error);
      }

      // 4. Observar a localização do jogador
      const locationWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (currentLocation) => {
          if (currentLocation.coords) {
            setLocation(currentLocation.coords);
            setLoading(false);
          }
        }
      );

      return () => {
        if (locationWatcher) {
          locationWatcher.remove();
        }
        if (soundObject) {
          soundObject.unloadAsync();
        }
      };
    })();
  }, []);

  // Efeito para atualizar o estado do jogo com base na localização e no tesouro
  useEffect(() => {
    if (location && treasureLocation) {
      const distanceMeters = calculateDistance(
        location.latitude,
        location.longitude,
        treasureLocation.latitude,
        treasureLocation.longitude
      );
      const steps = Math.round(distanceMeters / 0.8);
      setDistanceSteps(steps);
      animateBackground(steps);
      calculateAndRotateArrow();

      if (steps < 5 && !isTreasureFound) {
        setIsTreasureFound(true);
      }
      
      if (isTreasureFound) {
        setHint("Tesouro Encontrado!");
        animatedPulseRef.current.stopAnimation();
        if (!isMusicPlaying) {
          playFoundSound();
        }
      } else if (steps < 10) {
        setHint("Muito quente! Está quase lá!");
        Animated.loop(
          Animated.sequence([
            Animated.timing(animatedPulseRef.current, { toValue: 1, duration: 500, useNativeDriver: false }),
            Animated.timing(animatedPulseRef.current, { toValue: 0, duration: 500, useNativeDriver: false })
          ]),
          { iterations: -1 }
        ).start();
      } else {
        setHint(getHintText(steps));
        animatedPulseRef.current.stopAnimation();
      }
    }
  }, [location, treasureLocation, isTreasureFound]);

  // Funções de lógica do jogo
  const getHintText = (distSteps) => {
    if (distSteps < 25) {
      return "Quente! Está perto!";
    } else if (distSteps < 50) {
      return "Morno! Continue procurando.";
    } else {
      return "Frio! Está longe do tesouro.";
    }
  };

  const animateBackground = (distSteps) => {
    const value = distSteps >= 50 ? 0 : 1;
    animateValue(animatedBackgroundColorRef.current, value);
  };

  const calculateAndRotateArrow = () => {
    if (!location || !treasureLocation) return;
    if (isTreasureFound) return; // Não rotaciona a seta se o tesouro for encontrado

    const currentHeading = location.heading;
    if (currentHeading === null) return;

    const bearing = calculateBearing(
      location.latitude,
      location.longitude,
      treasureLocation.latitude,
      treasureLocation.longitude
    );

    let rotation = bearing - currentHeading;
    if (rotation > 180) rotation -= 360;
    if (rotation < -180) rotation += 360;

    const normalizedRotation = rotation / 360;
    animateValue(animatedRotationRef.current, normalizedRotation);
  };

  const playFoundSound = async () => {
    if (soundObject) {
      setIsMusicPlaying(true);
      try {
        await soundObject.setVolumeAsync(0.5);
        await soundObject.playAsync();
      } catch (error) {
        console.error("Erro ao reproduzir o som:", error);
      }
    }
  };

  const resetGame = () => {
    setLoading(true);
    setTreasureLocation(generateRandomTreasure(referencePoint, MAX_DISTANCE_METERS));
    if (soundObject) {
      soundObject.stopAsync();
      setIsMusicPlaying(false);
    }
    setIsTreasureFound(false);
    animatedPulseRef.current.stopAnimation();
    setLoading(false);
  };

  // Mapeia o valor animado para a cor
  const backgroundColor = animatedBackgroundColorRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['#87CEFA', '#FF4500'],
  });

  // Mapeia o valor animado para a rotação em graus
  const rotation = animatedRotationRef.current.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-360deg', '360deg'],
  });

  // Mapeia o valor animado para a escala da pulsação
  const pulseScale = animatedPulseRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Gerando o tesouro...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { backgroundColor }]}>
        <View style={styles.arrowContainer}>
          <Animated.Text style={[styles.arrow, { transform: [{ rotate: rotation }, { scale: pulseScale }] }]}>
            ↓
          </Animated.Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title}>Caça ao Tesouro</Text>
          <Text style={styles.hintText}>{hint}</Text>
          {!isTreasureFound && distanceSteps !== null && (
            <Text style={styles.distanceText}>
              Distância: {distanceSteps} passos
            </Text>
          )}
          {isTreasureFound && (
            <Text style={styles.foundText}>
              É necessário reiniciar o jogo para jogar novamente.
            </Text>
          )}
          <Text style={styles.coordsText}>
            Ponto de referência: ({referencePoint.latitude}, {referencePoint.longitude})
          </Text>
          <Text style={styles.coordsText}>
            Localização do tesouro: ({treasureLocation.latitude.toFixed(5)}, {treasureLocation.longitude.toFixed(5)})
          </Text>
          <Text style={styles.coordsText}>
            Sua localização: ({location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)})
          </Text>
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={resetGame}
          >
            <Text style={styles.resetButtonText}>Reiniciar Jogo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  infoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  distanceText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 5,
  },
  foundText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 5,
    textAlign: 'center',
  },
  coordsText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
  },
  arrowContainer: {
    position: 'absolute',
    top: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 150,
    color: '#fff',
    fontWeight: 'bold',
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  resetButtonText: {
    color: '#FF4500',
    fontWeight: 'bold',
  }
});
