import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  X,
  Trash2,
} from 'lucide-react-native';
import {
  getActivities,
  getParcels,
  createActivity,
  deleteActivity,
  type Activity,
  type Parcel,
} from '@/services/api';

export default function Diary() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [selectedParcelId, setSelectedParcelId] = useState('');
  const [activityType, setActivityType] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [machinery, setMachinery] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      const [activitiesData, parcelsData] = await Promise.all([
        getActivities(),
        getParcels(),
      ]);
      setActivities(activitiesData);
      setParcels(parcelsData);
    } catch (error) {
      console.error('Error loading diary data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateActivity = async () => {
    if (!activityType || !workerName) {
      Alert.alert('Greška', 'Molimo odaberite vrstu aktivnosti i unesite ime radnika');
      return;
    }

    const newActivity = {
      parcel_id: selectedParcelId || undefined,
      activity_type: activityType,
      worker_name: workerName,
      machinery: machinery || undefined,
      notes: notes || undefined,
      date,
      materials: [],
    };

    const result = await createActivity(newActivity);
    if (result) {
      setShowModal(false);
      resetForm();
      loadData();
    } else {
      Alert.alert('Greška', 'Nije moguće spremiti aktivnost');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    Alert.alert(
      'Potvrda brisanja',
      'Jeste li sigurni da želite obrisati ovu aktivnost?',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteActivity(id);
            if (success) {
              loadData();
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedParcelId('');
    setActivityType('');
    setWorkerName('');
    setMachinery('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const activityTypes = [
    { value: 'sjetva', label: 'Sjetva' },
    { value: 'gnojidba', label: 'Gnojidba' },
    { value: 'zaštita', label: 'Zaštita bilja' },
    { value: 'žetva', label: 'Žetva' },
    { value: 'oranje', label: 'Oranje' },
    { value: 'kultivacija', label: 'Kultivacija' },
  ];

  const activityTypeLabels: Record<string, string> = {
    sjetva: 'Sjetva',
    gnojidba: 'Gnojidba',
    zaštita: 'Zaštita bilja',
    žetva: 'Žetva',
    oranje: 'Oranje',
    kultivacija: 'Kultivacija',
  };

  const getParcelName = (parcelId: string) => {
    const parcel = parcels.find((p) => p.id === parcelId);
    return parcel?.name || 'Nepoznata parcela';
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-600 px-6 pt-14 pb-6">
        <Text className="text-white text-3xl font-bold mb-2">
          Digitalni dnevnik
        </Text>
        <Text className="text-primary-100 text-base mb-4">
          {activities.length} evidentiranih aktivnosti
        </Text>

        {/* View Mode Toggle */}
        <View className="flex-row bg-primary-700/50 rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              viewMode === 'list' ? 'bg-white' : ''
            }`}
          >
            <List
              size={20}
              color={viewMode === 'list' ? '#16a34a' : '#ffffff'}
            />
            <Text
              className={`ml-2 font-semibold ${
                viewMode === 'list' ? 'text-primary-600' : 'text-white'
              }`}
            >
              Popis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('calendar')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              viewMode === 'calendar' ? 'bg-white' : ''
            }`}
          >
            <CalendarIcon
              size={20}
              color={viewMode === 'calendar' ? '#16a34a' : '#ffffff'}
            />
            <Text
              className={`ml-2 font-semibold ${
                viewMode === 'calendar' ? 'text-primary-600' : 'text-white'
              }`}
            >
              Kalendar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="py-4">
          {loading ? (
            <Text className="text-gray-500 text-center py-8">
              Učitavanje...
            </Text>
          ) : activities.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <CalendarIcon size={48} color="#d1d5db" />
              <Text className="text-gray-500 text-center mt-4 text-base">
                Nemate evidentiranih aktivnosti
              </Text>
              <Text className="text-gray-400 text-center mt-2 text-sm">
                Dodajte prvu aktivnost u dnevnik
              </Text>
            </View>
          ) : (
            activities.map((activity) => (
              <View
                key={activity.id}
                className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-gray-900 text-xl font-bold mb-1">
                      {activityTypeLabels[activity.activity_type] ||
                        activity.activity_type}
                    </Text>
                    {activity.parcel_id && (
                      <Text className="text-gray-500 text-sm">
                        {getParcelName(activity.parcel_id)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteActivity(activity.id)}
                    className="p-2"
                  >
                    <Trash2 size={20} color="#dc2626" />
                  </TouchableOpacity>
                </View>

                <View className="border-t border-gray-100 pt-3 mt-2">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-gray-600 font-semibold w-32">
                      Datum:
                    </Text>
                    <Text className="text-gray-900">
                      {new Date(activity.date).toLocaleDateString('hr-HR')}
                    </Text>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-gray-600 font-semibold w-32">
                      Radnik:
                    </Text>
                    <Text className="text-gray-900">{activity.worker_name}</Text>
                  </View>
                  {activity.machinery && (
                    <View className="flex-row items-center mb-2">
                      <Text className="text-gray-600 font-semibold w-32">
                        Mehanizacija:
                      </Text>
                      <Text className="text-gray-900">{activity.machinery}</Text>
                    </View>
                  )}
                  {activity.notes && (
                    <View className="mt-2">
                      <Text className="text-gray-600 font-semibold mb-1">
                        Napomene:
                      </Text>
                      <Text className="text-gray-700">{activity.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        className="absolute bottom-8 right-6 bg-primary-600 w-16 h-16 rounded-full items-center justify-center shadow-lg"
        activeOpacity={0.8}
      >
        <Plus size={32} color="#ffffff" />
      </TouchableOpacity>

      {/* Add Activity Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          <View className="bg-primary-600 px-6 pt-14 pb-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-white text-2xl font-bold">
                Nova aktivnost
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            {/* Parcel Selection */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Parcela{' '}
                <Text className="text-gray-400 font-normal text-sm">
                  (neobavezno)
                </Text>
              </Text>
              {parcels.length === 0 ? (
                <Text className="text-gray-400 text-sm italic">
                  Nemate dodanih parcela
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {/* Opcija "Bez parcele" */}
                  <TouchableOpacity
                    onPress={() => setSelectedParcelId('')}
                    className={`mr-3 px-5 py-4 rounded-xl border-2 ${
                      selectedParcelId === ''
                        ? 'bg-gray-100 border-gray-400'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        selectedParcelId === '' ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      Bez parcele
                    </Text>
                  </TouchableOpacity>

                  {parcels.map((parcel) => (
                    <TouchableOpacity
                      key={parcel.id}
                      onPress={() => setSelectedParcelId(parcel.id)}
                      className={`mr-3 px-5 py-4 rounded-xl border-2 ${
                        selectedParcelId === parcel.id
                          ? 'bg-primary-100 border-primary-600'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          selectedParcelId === parcel.id
                            ? 'text-primary-700'
                            : 'text-gray-700'
                        }`}
                      >
                        {parcel.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Activity Type */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Vrsta aktivnosti *
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => setActivityType(type.value)}
                    className={`px-5 py-4 rounded-xl border-2 ${
                      activityType === type.value
                        ? 'bg-primary-100 border-primary-600'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        activityType === type.value
                          ? 'text-primary-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Worker Name */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Ime radnika *
              </Text>
              <TextInput
                value={workerName}
                onChangeText={setWorkerName}
                placeholder="Unesite ime radnika"
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Machinery */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Mehanizacija
              </Text>
              <TextInput
                value={machinery}
                onChangeText={setMachinery}
                placeholder="Npr. Traktor John Deere 6120"
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Notes */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Napomene
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Dodatne informacije..."
                multiline
                numberOfLines={4}
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleCreateActivity}
              className="bg-primary-600 py-5 rounded-xl mb-8"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-bold text-lg">
                Spremi aktivnost
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
