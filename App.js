// App.js
// Execute em um projeto Expo real, com react-navigation instalado:
// npm install @react-navigation/native @react-navigation/stack react-native-safe-area-context react-native-gesture-handler react-native-reanimated react-native-screens react-native-vector-icons react-native-get-random-values
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Easing, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

const referencePoint = { latitude: -23.11443, longitude: -45.70780 };
const SOUND_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const MAX_DISTANCE_METERS = 60;

// Funções auxiliares
const toRad = v => (v * Math.PI) / 180;
const toDeg = v => (v * 180) / Math.PI;
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const calculateBearing = (sLat, sLon, eLat, eLon) => {
  sLat = toRad(sLat); sLon = toRad(sLon); eLat = toRad(eLat); eLon = toRad(eLon);
  const y = Math.sin(eLon - sLon) * Math.cos(eLat);
  const x = Math.cos(sLat) * Math.sin(eLat) - Math.sin(sLat) * Math.cos(eLat) * Math.cos(eLon - sLon);
  let br = toDeg(Math.atan2(y, x));
  return br < 0 ? br + 360 : br;
};
const animateValue = (ref, toValue) => {
  Animated.timing(ref, { toValue, duration: 500, easing: Easing.linear, useNativeDriver: false }).start();
};
const generateRandomTreasure = (center, maxD) => {
  const R = 6371e3;
  const latRad = toRad(center.latitude);
  const lonRad = toRad(center.longitude);
  const rDist = Math.random() * maxD;
  const rAng = Math.random() * 2 * Math.PI;
  const newLatRad = Math.asin(Math.sin(latRad)*Math.cos(rDist/R) + Math.cos(latRad)*Math.sin(rDist/R)*Math.cos(rAng));
  const newLonRad = lonRad + Math.atan2(Math.sin(rAng)*Math.sin(rDist/R)*Math.cos(latRad),
    Math.cos(rDist/R)-Math.sin(latRad)*Math.sin(newLatRad));
  return { latitude: toDeg(newLatRad), longitude: toDeg(newLonRad) };
};

// SplashScreen
const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Home'), 3000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={splash.container}>
      <Image source={require('./src/img/logo.png')} style={splash.logo} />
      <Text style={splash.text}>Bem-vindo(a) ao Treasure Hunt!</Text>
    </View>
  );
};

// Tela principal
const HomeScreen = () => {
  const [location, setLocation] = useState(null);
  const [treasureLocation, setTreasureLocation] = useState(null);
  const [hint, setHint] = useState("Procurando sua localização...");
  const [distanceSteps, setDistanceSteps] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isTreasureFound, setIsTreasureFound] = useState(false);
  const [soundObject, setSoundObject] = useState(null);
  const [loading, setLoading] = useState(true);

  const animatedBackgroundColorRef = useRef(new Animated.Value(0));
  const animatedRotationRef = useRef(new Animated.Value(0));
  const animatedPulseRef = useRef(new Animated.Value(0));

  useEffect(() => {
    (async () => {
      setTreasureLocation(generateRandomTreasure(referencePoint, MAX_DISTANCE_METERS));
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHint('Permissão negada.');
        setLoading(false);
        return;
      }
      const sound = new Audio.Sound();
      try {
        await sound.loadAsync({ uri: SOUND_URL });
        sound.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) setIsMusicPlaying(false); });
        setSoundObject(sound);
      } catch (e) { console.error(e); }
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (pos) => {
          setLocation(pos.coords);
          setLoading(false);
        }
      );
      return () => { watcher && watcher.remove(); soundObject && soundObject.unloadAsync(); };
    })();
  }, []);

  useEffect(() => {
    if (location && treasureLocation) {
      if (!isTreasureFound) {
        const dMeters = calculateDistance(location.latitude, location.longitude, treasureLocation.latitude, treasureLocation.longitude);
        const steps = Math.round(dMeters / 0.8);
        setDistanceSteps(steps);
        animateValue(animatedBackgroundColorRef.current, dMeters >= 40 ? 0 : 1);
        if (location.heading != null) {
          const bearing = calculateBearing(location.latitude, location.longitude, treasureLocation.latitude, treasureLocation.longitude);
          let rot = bearing - location.heading;
          if (rot > 180) rot -= 360; if (rot < -180) rot += 360;
          animateValue(animatedRotationRef.current, rot / 360);
        }
        if (dMeters < 5) { setIsTreasureFound(true); }
        else if (dMeters < 10) {
          setHint("Muito quente! Está quase lá!");
          Animated.loop(Animated.sequence([
            Animated.timing(animatedPulseRef.current,{ toValue:1,duration:500,useNativeDriver:false}),
            Animated.timing(animatedPulseRef.current,{ toValue:0,duration:500,useNativeDriver:false})
          ])).start();
        } else {
          setHint(steps < 25 ? "Quente! Está perto!" : steps < 50 ? "Morno! Continue procurando." : "Frio! Está longe do tesouro.");
        }
      } else {
        setHint("Tesouro Encontrado!");
        if (!isMusicPlaying && soundObject) {
          (async () => {
            setIsMusicPlaying(true);
            await soundObject.setVolumeAsync(0.5);
            await soundObject.playAsync();
          })();
        }
      }
    }
  }, [location, treasureLocation, isTreasureFound, isMusicPlaying]);

  const resetGame = () => {
    setLoading(true);
    setTreasureLocation(generateRandomTreasure(referencePoint, MAX_DISTANCE_METERS));
    soundObject?.stopAsync();
    setIsMusicPlaying(false);
    setIsTreasureFound(false);
    animatedPulseRef.current.stopAnimation();
    setLoading(false);
  };

  if (loading) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>Gerando o tesouro...</Text></View>;

  const backgroundColor = animatedBackgroundColorRef.current.interpolate({ inputRange:[0,1], outputRange:['#87CEFA','#FF4500'] });
  const rotation = animatedRotationRef.current.interpolate({ inputRange:[-1,1], outputRange:['-360deg','360deg'] });
  const pulseScale = animatedPulseRef.current.interpolate({ inputRange:[0,1], outputRange:[1,1.2] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container,{ backgroundColor }]}>
        <View style={styles.arrowContainer}>
          <Animated.Text style={[styles.arrow,{ transform:[{rotate:rotation},{scale:pulseScale}] }]}>↑</Animated.Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.title}>Caça ao Tesouro</Text>
          <Text style={styles.hintText}>{hint}</Text>
          {!isTreasureFound && distanceSteps!==null && <Text style={styles.distanceText}>Distância: {distanceSteps} passos</Text>}
          {isTreasureFound && <Text style={styles.foundText}>Reinicie o jogo para jogar novamente.</Text>}
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reiniciar Jogo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default function App(){
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown:false}}>
        <Stack.Screen name="Splash" component={SplashScreen}/>
        <Stack.Screen name="Home" component={HomeScreen}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// estilos do splash
const splash = StyleSheet.create({
  container:{flex:1,backgroundColor:'#4A90E2',alignItems:'center',justifyContent:'center'},
  logo:{width:120,height:120,marginBottom:20},
  text:{fontSize:24,color:'#fff',fontWeight:'bold'}
});

// estilos do jogo
const styles = StyleSheet.create({
  safeArea:{flex:1},
  container:{flex:1,alignItems:'center',justifyContent:'center',padding:20},
  loadingContainer:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#fff'},
  loadingText:{fontSize:20,fontWeight:'bold'},
  arrowContainer:{position:'absolute',top:'20%',alignItems:'center'},
  arrow:{fontSize:150,color:'#fff',fontWeight:'bold'},
  infoContainer:{backgroundColor:'rgba(0,0,0,0.4)',padding:20,borderRadius:15,marginTop:20,alignItems:'center'},
  title:{fontSize:28,fontWeight:'bold',color:'#fff'},
  hintText:{fontSize:22,fontWeight:'bold',color:'#fff',marginTop:10,textAlign:'center'},
  distanceText:{fontSize:18,color:'#fff',marginTop:5},
  foundText:{fontSize:16,color:'#fff',marginTop:5,textAlign:'center'},
  resetButton:{marginTop:20,paddingVertical:10,paddingHorizontal:20,backgroundColor:'#fff',borderRadius:10},
  resetButtonText:{color:'black',fontWeight:'bold'}
});
