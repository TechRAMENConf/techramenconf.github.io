# Product Context

This document describes the purpose of the project, the problems it solves, how it should work, and the user experience goals.

## Purpose

- 北海道上川郡で一年に一度開催される技術カンファレンス「TechRAMEN Conference」の公式ホームページとして機能する。
- 運営委員からのお知らせ、基調講演の内容、スポンサー情報などを一元的に提供する。
- カンファレンスのコンセプト「上川地方に技術の知見を惜しみなく注ぐ，技術好きのための円卓会議」を伝える。
- 技術コミュニティの交流と知識共有の場としてのカンファレンスの価値を表現する。

## Problems Solved

- カンファレンスに関する情報（日程、場所、スピーカー、スポンサー）を参加者やスポンサーに効率的に伝える。
- 過去のカンファレンスの情報をアーカイブとして保持し、参照可能にする。
- 地方で開催される技術カンファレンスの認知度を高め、参加者とスポンサーを集める。
- 技術コミュニティの継続的な発展と交流を促進する。

## How it Works

- Astroフレームワークを使用して静的なウェブサイトとして構築される。
- コンテンツは主にMarkdownやJSONファイルで管理され、コンポーネントによって表示される。
- ウェブサイトは以下の主要セクションで構成される：
  - About（カンファレンスの概要）
  - Speakers（登壇者情報）
  - Supports（スポンサー情報）
- /2024 のようなディレクトリで過去のカンファレンスのコンテンツを管理し、アーカイブとして提供する。
- 現在のサイトはシンプルな構造だが、2025年のカンファレンス情報が決まり次第、コンテンツを拡充する予定。

## User Experience Goals

- 訪問者がカンファレンスの情報（日程、場所、スピーカー、スポンサー）を簡単に見つけられるようにする。
- シンプルで分かりやすいナビゲーションを提供し、目的の情報に素早くアクセスできるようにする。
- モバイルフレンドリーなレスポンシブデザインにより、様々なデバイスからのアクセスに対応する。
- 「Shippori Antique」や「Chivo Mono」などの読みやすいフォントを使用し、テキストの可読性を高める。
- カンファレンスの雰囲気や価値を視覚的に伝えるデザインを採用する。
