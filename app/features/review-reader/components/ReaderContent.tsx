import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import RenderHtml from "react-native-render-html";

export type ReaderPage = {
  reviewIndex: number;
  author: string;
  html: string;
  pageInReview: number;
};

type ReaderContentProps = {
  page: ReaderPage;
  contentWidth: number;
  onLayout?: (height: number) => void;
};

export const ReaderContent = memo(function ReaderContent({
  page,
  contentWidth,
  onLayout,
}: ReaderContentProps) {
  return (
    <View
      style={styles.content}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.height) : undefined}
    >
      {page.pageInReview === 0 ? (
        <Text style={styles.author}>{page.author}</Text>
      ) : (
        <Text style={styles.continued}>Continued</Text>
      )}
      <RenderHtml
        contentWidth={contentWidth}
        source={{ html: page.html }}
        systemFonts={["Literata-Regular"]}
        baseStyle={styles.body}
        tagsStyles={tagStyles}
      />
    </View>
  );
});

const tagStyles = {
  p: { fontSize: 15, lineHeight: 25, marginBottom: 12, textAlign: "justify" as const },
  li: { marginBottom: 6 },
};

const styles = StyleSheet.create({
  content: { paddingVertical: 28 },
  body: { fontFamily: "Literata-Regular" },
  author: { fontFamily: "Literata-Medium", fontSize: 15, marginBottom: 10 },
  continued: { color: "#8b8780", fontSize: 12, letterSpacing: 0.6, marginBottom: 10 },
});
