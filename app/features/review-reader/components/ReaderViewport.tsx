import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReaderContent } from "./ReaderContent";
import type { ReaderPage } from "./ReaderContent";
import type { Measurement } from "../reader/useHtmlPageReader";

type ReaderViewportProps = {
  page: ReaderPage | undefined;
  measurement: Measurement | undefined;
  contentWidth: number;
  pageNumber: number;
  pageCount: number;
  onMeasure: (height: number, generation: number, requestId: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onLayout: (height: number) => void;
  footer?: ReactNode;
  isPreparing?: boolean;
  isComplete?: boolean;
  canPrevious: boolean;
  canNext: boolean;
};

export function ReaderViewport({
  page,
  measurement,
  contentWidth,
  pageNumber,
  pageCount,
  onMeasure,
  onPrevious,
  onNext,
  onLayout,
  footer,
  isPreparing,
  isComplete = false,
  canPrevious,
  canNext,
}: ReaderViewportProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.viewport} onLayout={(event) => onLayout(event.nativeEvent.layout.height)}>
        {page ? <ReaderContent page={page} contentWidth={contentWidth} /> : isPreparing ? <ActivityIndicator /> : null}
        <View pointerEvents="none" style={styles.progress}>
          <Text style={styles.progressText}>{pageCount ? (isComplete ? `${pageNumber} / ${pageCount}` : `Page ${pageNumber}`) : "Preparing review…"}</Text>
        </View>
        <Pressable disabled={!canPrevious} style={styles.leftZone} onPress={onPrevious} accessibilityRole="button" accessibilityState={{ disabled: !canPrevious }} accessibilityLabel="Previous review page" accessibilityHint="Tap to read the previous page" />
        <Pressable disabled={!canNext} style={styles.rightZone} onPress={onNext} accessibilityRole="button" accessibilityState={{ disabled: !canNext }} accessibilityLabel="Next review page" accessibilityHint="Tap to read the next page" />
        {measurement ? (
          <View key={`${measurement.generation}:${measurement.requestId}`} pointerEvents="none" style={styles.measurement} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ReaderContent page={measurement.page} contentWidth={contentWidth} onLayout={(height) => onMeasure(height, measurement.generation, measurement.requestId)} />
          </View>
        ) : null}
      </View>
      {footer ? <View style={[styles.footer, { bottom: insets.bottom }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#fbfaf7", flex: 1, paddingHorizontal: 24, position: "relative" },
  viewport: { flex: 1, overflow: "hidden", position: "relative" },
  progress: { alignItems: "center", bottom: 8, left: 0, position: "absolute", right: 0 },
  progressText: { color: "#8b8780", fontSize: 12 },
  leftZone: { bottom: 0, left: -24, position: "absolute", top: 0, width: "30%" },
  rightZone: { bottom: 0, position: "absolute", right: -24, top: 0, width: "30%" },
  measurement: { left: -10000, opacity: 0, position: "absolute", top: 0, width: "100%" },
  footer: { left: 0, position: "absolute", right: 0 },
});
