import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Share,
} from 'react-native';
import {
  UserPlus,
  Trash2,
  X,
  Share2,
  Pencil,
} from 'lucide-react-native';
import {
  getTeamMembers,
  deleteTeamMember,
  updateTeamMember,
  getOPGProfile,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getCurrentUser,
  type TeamMember,
  type JoinRequest,
  type OGPProfile,
} from '@/services/api';

type RoleKey = 'vlasnik' | 'clan' | 'radnik';

const ROLES: { value: RoleKey; label: string; emoji: string; opis: string }[] = [
  { value: 'vlasnik', label: 'Vlasnik', emoji: '👑', opis: 'Puni pristup i upravljanje' },
  { value: 'clan', label: 'Član', emoji: '👤', opis: 'Upravljanje parcelama i evidencijom' },
  { value: 'radnik', label: 'Radnik', emoji: '👨‍🌾', opis: 'Pregled i dodavanje aktivnosti' },
];

function getRoleInfo(role: string) {
  return ROLES.find((r) => r.value === role) ?? { emoji: '👤', label: role, opis: '' };
}

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [opgProfile, setOpgProfile] = useState<OGPProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal za uređivanje člana
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<RoleKey>('clan');
  const [editSaving, setEditSaving] = useState(false);

  // Modal za dijeljenje koda
  const [showCodeModal, setShowCodeModal] = useState(false);

  const isOwner = opgProfile !== null; // getOPGProfile vraća podatke samo vlasniku

  const loadData = async () => {
    try {
      const [membersData, requestsData, profileData, user] = await Promise.all([
        getTeamMembers(),
        getJoinRequests(),
        getOPGProfile(),
        getCurrentUser(),
      ]);
      setMembers(membersData);
      setJoinRequests(requestsData);
      setOpgProfile(profileData);
      setCurrentUserId(user?.id ?? null);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Uredi člana ─────────────────────────────────────────
  function openEdit(member: TeamMember) {
    setEditMember(member);
    setEditName(member.name);
    setEditRole(member.role as RoleKey);
  }

  async function handleSaveEdit() {
    if (!editMember || !editName.trim()) return;
    setEditSaving(true);

    const updates: { name?: string; role?: string } = {};
    if (editName.trim() !== editMember.name) updates.name = editName.trim();
    if (editRole !== editMember.role) updates.role = editRole;

    if (Object.keys(updates).length === 0) {
      setEditMember(null);
      setEditSaving(false);
      return;
    }

    const ok = await updateTeamMember(editMember.id, updates);
    setEditSaving(false);
    if (ok) {
      setEditMember(null);
      loadData();
    } else {
      Alert.alert('Greška', 'Nije moguće ažurirati člana. Provjeri ovlaštenja.');
    }
  }

  // ── Ukloni člana ────────────────────────────────────────
  function confirmDelete(member: TeamMember) {
    Alert.alert(
      'Ukloni člana',
      `Jeste li sigurni da želite ukloniti "${member.name}" iz tima?`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Ukloni',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteTeamMember(member.id);
            if (ok) loadData();
          },
        },
      ]
    );
  }

  // ── Odobri/odbij zahtjev ─────────────────────────────────
  function confirmApprove(req: JoinRequest) {
    Alert.alert(
      'Odobri pristup',
      `Odobriti "${req.puno_ime}" pristup OPG-u?`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Odobri',
          onPress: async () => {
            const ok = await approveJoinRequest(req.id);
            if (ok) { Alert.alert('Uspjeh', `${req.puno_ime} je dodan u tim.`); loadData(); }
            else Alert.alert('Greška', 'Nije moguće odobriti zahtjev.');
          },
        },
      ]
    );
  }

  function confirmReject(req: JoinRequest) {
    Alert.alert(
      'Odbij zahtjev',
      `Odbiti zahtjev od "${req.puno_ime}"?`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Odbij',
          style: 'destructive',
          onPress: async () => {
            const ok = await rejectJoinRequest(req.id);
            if (ok) loadData();
          },
        },
      ]
    );
  }

  // ── Podijeli kod ─────────────────────────────────────────
  async function handleShareCode() {
    if (!opgProfile?.kod_pristupa) return;
    try {
      await Share.share({
        message: `Pridruži se OPG-u "${opgProfile.naziv}" u AgroPlan aplikaciji!\n\nKod pristupa: ${opgProfile.kod_pristupa}`,
        title: 'AgroPlan — Pozivnica',
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  }

  // ────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-600 px-6 pt-14 pb-8">
        <Text className="text-white text-3xl font-bold mb-1">Tim & OPG</Text>
        <Text className="text-primary-100 text-base">
          {members.length} {members.length === 1 ? 'član' : 'članova'} u timu
          {joinRequests.length > 0 && (
            <Text className="text-amber-300"> · {joinRequests.length} zahtjeva</Text>
          )}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="py-4">

          {/* Kod pristupa — prikazuje se samo vlasniku */}
          {opgProfile && (
            <TouchableOpacity
              className="bg-green-50 border border-green-300 rounded-2xl p-5 mb-5 flex-row items-center"
              onPress={() => setShowCodeModal(true)}
              activeOpacity={0.8}
            >
              <View className="flex-1">
                <Text className="text-green-700 font-semibold text-sm mb-1">
                  🔑 Kod pristupa OPG-a
                </Text>
                <Text className="text-green-900 font-bold text-2xl tracking-widest">
                  {opgProfile.kod_pristupa ?? '—'}
                </Text>
                <Text className="text-green-600 text-xs mt-1">
                  Dodirni za dijeljenje koda s novim članovima
                </Text>
              </View>
              <Share2 size={22} color="#16a34a" />
            </TouchableOpacity>
          )}

          {/* Zahtjevi za pristup */}
          {joinRequests.length > 0 && (
            <View className="mb-5">
              <Text className="text-gray-900 font-bold text-base mb-3">
                ⏳ Zahtjevi za pristup ({joinRequests.length})
              </Text>
              {joinRequests.map((req) => (
                <View
                  key={req.id}
                  className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-3"
                >
                  <Text className="text-gray-900 font-bold text-base mb-0.5">
                    {req.puno_ime}
                  </Text>
                  <Text className="text-gray-400 text-xs mb-3">
                    {new Date(req.created_at).toLocaleDateString('hr-HR')}
                  </Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => confirmReject(req)}
                      className="flex-1 bg-red-100 rounded-xl py-3 items-center"
                    >
                      <Text className="text-red-700 font-semibold">Odbij</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmApprove(req)}
                      className="flex-1 bg-green-600 rounded-xl py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Odobri</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Članovi tima */}
          <Text className="text-gray-900 font-bold text-base mb-3">Članovi</Text>

          {loading ? (
            <Text className="text-gray-500 text-center py-8">Učitavanje...</Text>
          ) : members.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <UserPlus size={48} color="#d1d5db" />
              <Text className="text-gray-500 text-center mt-4 text-base">
                Još nema članova u timu
              </Text>
              {isOwner && (
                <Text className="text-gray-400 text-center mt-2 text-sm">
                  Dijeli kod pristupa da dodaš članove
                </Text>
              )}
            </View>
          ) : (
            members.map((member) => {
              const roleInfo = getRoleInfo(member.role);
              const isMe = member.id === currentUserId;
              const canEdit = isOwner && !isMe;

              return (
                <View
                  key={member.id}
                  className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100"
                >
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{roleInfo.emoji}</Text>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-gray-900 text-lg font-bold">
                          {member.name}
                        </Text>
                        {isMe && (
                          <View className="bg-gray-100 px-2 py-0.5 rounded-lg">
                            <Text className="text-gray-500 text-xs">ti</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-primary-600 font-semibold text-sm">
                        {roleInfo.label}
                      </Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        Od: {new Date(member.created_at).toLocaleDateString('hr-HR')}
                      </Text>
                    </View>

                    {/* Akcije — samo vlasnik i ne za sebe */}
                    {canEdit && (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => openEdit(member)}
                          className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center"
                        >
                          <Pencil size={17} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDelete(member)}
                          className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center"
                        >
                          <Trash2 size={17} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Statistika */}
          {members.length > 0 && (
            <View className="bg-white rounded-2xl p-5 mt-2 mb-6 border border-gray-100">
              <Text className="text-gray-900 font-bold mb-3">Statistika tima</Text>
              <View className="flex-row justify-around">
                {ROLES.map((role) => (
                  <View key={role.value} className="items-center">
                    <Text className="text-2xl font-bold text-primary-600">
                      {members.filter((m) => m.role === role.value).length}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-1">{role.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── MODAL: Uredi člana ── */}
      <Modal
        visible={editMember !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditMember(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Uredi člana</Text>
              <TouchableOpacity onPress={() => setEditMember(null)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Ime */}
            <Text className="text-sm font-medium text-gray-700 mb-1">Ime i prezime</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-5"
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
            />

            {/* Uloga */}
            <Text className="text-sm font-medium text-gray-700 mb-2">Uloga</Text>
            <View className="gap-2 mb-6">
              {ROLES.filter((r) => r.value !== 'vlasnik').map((role) => (
                <TouchableOpacity
                  key={role.value}
                  onPress={() => setEditRole(role.value)}
                  className={`flex-row items-center p-4 rounded-xl border-2 ${
                    editRole === role.value
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className="text-xl mr-3">{role.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`font-bold ${editRole === role.value ? 'text-primary-700' : 'text-gray-900'}`}>
                      {role.label}
                    </Text>
                    <Text className="text-gray-500 text-xs mt-0.5">{role.opis}</Text>
                  </View>
                  {editRole === role.value && (
                    <View className="w-5 h-5 bg-primary-600 rounded-full items-center justify-center">
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditMember(null)}
                className="flex-1 bg-gray-100 rounded-xl py-4"
              >
                <Text className="text-gray-700 text-center font-bold">Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editSaving || !editName.trim()}
                className={`flex-1 rounded-xl py-4 ${editSaving || !editName.trim() ? 'bg-gray-300' : 'bg-primary-600'}`}
              >
                <Text className="text-white text-center font-bold">
                  {editSaving ? 'Sprema...' : 'Spremi'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Kod pristupa ── */}
      <Modal
        visible={showCodeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCodeModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Kod pristupa</Text>
              <TouchableOpacity onPress={() => setShowCodeModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="bg-green-50 border-2 border-green-400 rounded-2xl p-6 items-center mb-4">
              <Text className="text-gray-500 text-sm mb-2">{opgProfile?.naziv}</Text>
              <Text className="text-green-900 font-bold text-4xl tracking-widest">
                {opgProfile?.kod_pristupa}
              </Text>
            </View>

            <Text className="text-gray-500 text-sm text-center mb-6">
              Pošalji ovaj kod osobama koje se žele pridružiti tvom OPG-u.
              Morat ćeš odobriti njihov zahtjev kada ga pošalju.
            </Text>

            <TouchableOpacity
              className="bg-primary-600 rounded-xl py-4 flex-row items-center justify-center"
              onPress={handleShareCode}
            >
              <Share2 size={20} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">Podijeli kod</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
