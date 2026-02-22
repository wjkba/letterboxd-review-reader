import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useState, useEffect } from "react";
import {
	Button,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { getHistory, formatSlugToTitle } from "@/utils/history";

const MONO_FONT = "monospace";

export default function Index() {
	const [slug, setSlug] = useState("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [recentFilms, setRecentFilms] = useState<string[]>([]);
	const navigation = useNavigation();

	useEffect(() => {
		setRecentFilms(getHistory());
	}, []);

	useLayoutEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<Pressable
					style={{ marginRight: 16 }}
					onPress={() => router.push("/SettingsScreen")}
				>
					<Ionicons name="settings-outline" size={24} color="#222" />
				</Pressable>
			),
		});
	}, [navigation]);

	function handleInputChange(userInputSlug: string) {
		const formattedSlug = userInputSlug.replace(/\s+/g, "-");
		setSlug(formattedSlug);
	}

	async function handleLoadReviews() {
		const trimmedSlug = slug.trim();

		if (!trimmedSlug.length) {
			setErrorMessage("Please enter a film slug");
			return;
		}

		router.push({
			pathname: "/ReviewsScreen",
			params: {
				slug,
			},
		});
	}

	return (
		<View style={styles.centeredContainer}>
			<View style={styles.inputContainer}>
				<TextInput
					value={slug}
					onChangeText={handleInputChange}
					placeholder="Letterboxd film slug"
					style={styles.input}
					keyboardType="default"
					autoFocus={true}
				/>
				<Button onPress={handleLoadReviews} title="Load Reviews" />
			</View>

			{recentFilms.length > 0 && (
				<View style={styles.recentContainer}>
					<Text style={styles.recentTitle}>Recent</Text>
					{recentFilms.map((item) => (
						<TouchableOpacity
							key={item}
							style={styles.recentItem}
							onPress={() => {
								setSlug(item);
								router.push({
									pathname: "/ReviewsScreen",
									params: { slug: item },
								});
							}}
						>
							<Text style={styles.recentText}>{formatSlugToTitle(item)}</Text>
						</TouchableOpacity>
					))}
				</View>
			)}

			{errorMessage && <Text>{errorMessage}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	centeredContainer: {
		flex: 1,
		paddingTop: 48,
		alignItems: "center",
	},
	inputContainer: {
		marginBottom: 32,
	},
	input: {
		width: 200,
		textAlign: "center",
		backgroundColor: "white",
		borderWidth: 1,
		marginBottom: 8,
		paddingHorizontal: 8,
	},
	recentContainer: {
		width: "100%",
		paddingHorizontal: 24,
		marginTop: 24,
	},
	recentTitle: {
		fontSize: 14,
		fontFamily: MONO_FONT,
		color: "#333",
		marginBottom: 12,
		fontWeight: "bold",
	},
	recentItem: {
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
	},
	recentText: {
		fontSize: 14,
		fontFamily: MONO_FONT,
		color: "#000",
	},
});
