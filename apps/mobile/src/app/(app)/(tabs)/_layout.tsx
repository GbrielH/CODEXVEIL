import { Tabs } from 'expo-router';
import { callsEnabled } from '@/lib/livekit';
import {
  LayoutDashboard,
  Sparkles,
  Video,
  ScrollText,
  Swords,
  UserRound,
} from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';

/** Navegação principal: abas inferiores com alvos de toque grandes. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.fgAccent,
        headerTitleStyle: { fontFamily: fonts.display },
        tabBarStyle: {
          backgroundColor: colors.raised,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarActiveBackgroundColor: 'rgba(107, 59, 198, 0.28)',
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, paddingVertical: 2 },
        tabBarActiveTintColor: colors.fgAccent,
        tabBarInactiveTintColor: colors.fgMuted,
        // Só ícones (os nomes cortavam em telas estreitas; o leitor de tela anuncia o título).
        tabBarShowLabel: false,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, marginTop: 2 },
        tabBarAllowFontScaling: false,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Painel',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="campanhas"
        options={{
          title: 'Campanhas',
          tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="personagens"
        options={{
          title: 'Personagens',
          tabBarIcon: ({ color, size }) => <Swords color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="call"
        options={{
          // Em teste: fora da barra até a chave ser ligada.
          href: callsEnabled ? undefined : null,
          title: 'Call',
          tabBarIcon: ({ color, size }) => <Video color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tomo"
        options={{
          title: 'Tomo',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
